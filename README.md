# 가계부 웹사이트 프로젝트 정리

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [인프라 구성](#3-인프라-구성)
4. [프로젝트 파일 구조](#4-프로젝트-파일-구조)
5. [데이터 파이프라인](#5-데이터-파이프라인)
6. [Prisma 설정](#6-prisma-설정)
7. [Server Actions](#7-server-actions)
8. [인증 (next-auth v5)](#8-인증-next-auth-v5)
9. [프론트엔드 페이지](#9-프론트엔드-페이지) (로그인, 사이드바, 차트, 수동추가, **엑셀 페이지**)
10. [CI/CD (GitHub Actions)](#10-cicd-github-actions)
11. [환경변수 (.env)](#11-환경변수-env)
12. [전체 흐름 요약](#12-전체-흐름-요약)

---

## 1. 프로젝트 개요

카드사에서 받은 엑셀 파일을 Claude API로 파싱·분류하고 MySQL에 저장한 뒤,
Next.js + D3로 월별 지출을 시각화하는 개인 가계부 웹 서비스.

**핵심 특징**

- 엑셀을 업로드하면 AI가 자동으로 카테고리 분류
- 엑셀 외에 현금 지출 등 수동 항목 추가 가능
- 본인만 사용하므로 단일 비밀번호 인증
- D3 차트에 월 변경 시 애니메이션 재생

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) |
| ORM | Prisma |
| DB | MySQL |
| 인증 | next-auth v5 (Credentials) |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| 차트 | D3.js |
| 엑셀 파싱 | xlsx |
| 스토리지 | DigitalOcean Spaces (S3 호환) |
| 서버 | DigitalOcean Droplet ($6/mo, 1GB RAM) |
| 프로세스 관리 | pm2 |
| CI/CD | GitHub Actions |

---

## 3. 인프라 구성

### 역할 분리

| 인프라 | 역할 |
|--------|------|
| **DigitalOcean Spaces** | 엑셀 원본 파일 영구 보관 (백업) |
| **Droplet** | Next.js 서버 + MySQL + 파싱·분류 스크립트 실행 |
| **MySQL** | 정제·분류된 거래 데이터 저장 |

### Spaces를 쓰는 이유

- **데이터 이중화**: MySQL이 날아가도 엑셀 원본으로 재처리 가능
- **처리 이력 관리**: 파일명(`202602_usage.xlsx`)으로 월별 처리 현황 추적 가능

### $6 Droplet 안정화 (1GB RAM — 필수 설정)

MySQL + Next.js를 한 서버에 올리면 메모리가 부족할 수 있어 아래 두 가지를 반드시 적용.

**① Swap 2GB 설정**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**② MySQL 메모리 최소화** (`/etc/mysql/mysql.conf.d/mysqld.cnf`)

```ini
innodb_buffer_pool_size = 64M
innodb_log_buffer_size  = 8M
max_connections         = 20
```

### 보안 (Nginx rate limiting)

로그인 엔드포인트에 요청 제한을 걸어 브루트포스 차단.

**주의:** `rate=5r/m`, `burst=3`처럼 너무 낮으면, 로그인 실패 시에도 503이 날 수 있음.  
(한 번 로그인 시도에 session 조회 + callback 등 여러 번 `/api/auth` 요청이 나가서 burst를 초과함.)

```nginx
# /etc/nginx/nginx.conf
# 분당 20회, burst 10으로 정상 로그인/실패 흐름은 통과, 브루트포스는 완화
limit_req_zone $binary_remote_addr zone=login:10m rate=20r/m;

# 서버 블록 안에
location /api/auth {
  limit_req zone=login burst=10 nodelay;
  proxy_pass http://localhost:3000;
}
```

---

## 4. 프로젝트 파일 구조

```
/
├── prisma/
│   └── schema.prisma              ← DB 스키마 정의
├── scripts/
│   └── process-excel.js           ← 엑셀 파싱 + AI 분류 + DB 저장 통합 스크립트
├── src/
│   ├── auth.ts                    ← next-auth 설정
│   ├── actions/
│   │   └── transactions.ts        ← Server Actions (조회·추가·삭제)
│   ├── lib/
│   │   └── prisma.ts              ← Prisma 싱글턴 인스턴스
│   ├── components/
│   │   ├── Sidebar.tsx            ← 좌측 사이드바
│   │   └── charts/
│   │       ├── BarChart.tsx       ← D3 바 차트 (애니메이션)
│   │       └── DonutChart.tsx     ← D3 도넛 차트 (애니메이션)
│   └── app/
│       ├── page.tsx               ← 로그인 페이지 (메인)
│       ├── chart/
│       │   └── page.tsx           ← 차트 대시보드
│       ├── add/
│       │   └── page.tsx           ← 수동 지출 추가 폼
│       └── excel/
│           └── page.tsx           ← 엑셀 저장 페이지 (업로드 후 저장 시 alert "저장되었습니다!")
├── public/                        ← 정적 파일 (글꼴 등)
│   └── fonts/                     ← Paperlogy 글꼴 파일을 직접 배치 (예: .woff2, .woff)
├── middleware.ts                  ← 라우트 보호
├── .github/
│   └── workflows/
│       └── deploy.yml             ← GitHub Actions 배포 워크플로우
└── .env                          ← 환경변수
```

---

## 5. 데이터 파이프라인

### 실제 엑셀 구조 (202602_usage.xlsx 기준)

| 행 | 내용 |
|----|------|
| 1행 | 빈 행 (패딩) |
| 2~3행 | 2단 병합 헤더 |
| 4행~ | 실제 거래 데이터 |
| 마지막 2행 | `본인회원 소 계` / `합 계` 요약 행 → **파싱 시 제거 필수** |

**주의사항**

- 날짜 형식: `YY.MM.DD` (예: `26.01.14`) → Claude API에서 `YYYY-MM-DD`로 변환 지시
- 금액: 숫자형 그대로 → 쉼표 제거 불필요
- 칼럼 0번: 항상 빈 열 → 무시

### 카테고리 분류 기준

| 카테고리 | 하위 카테고리 예시 |
|---------|-----------------|
| 식비 | 카페, 식당, 배달 |
| 생활·마트 | 대형마트, 편의점, 온라인쇼핑, 통신비, 관리비 |
| 교통 | 주유, 대중교통, 택시 |
| 의료 | 병원, 약국 |
| 문화·여가 | OTT, 영화, 스포츠, 여행 |
| 교육 | 학원, 서적, 온라인강의 |
| 기타 | 분류 불가 항목 |

### 통합 스크립트 (`scripts/process-excel.js`)

`xlsx`로 바이너리 → 텍스트 추출 후, Claude API 한 번 호출로 날짜 변환 + 카테고리 분류 + DB 저장까지 처리.

```bash
npm install xlsx @anthropic-ai/sdk
```

```js
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const client = new Anthropic();
const prisma = new PrismaClient();

async function processExcel(filePath, sourceFile) {
  const workbook = XLSX.readFile(filePath);
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const raw      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 2단 헤더(1~3행) + 마지막 소계/합계 2행 제거
  const dataRows = raw
    .slice(3, raw.length - 2)
    .filter((row) => row[1] && row[4]);

  // 중복 체크
  const existing = await prisma.transaction.count({ where: { sourceFile } });
  if (existing > 0) {
    console.log(`${sourceFile} 이미 처리됨 — 스킵`);
    return;
  }

  const BATCH_SIZE = 30;
  const results   = [];

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batchText = dataRows
      .slice(i, i + BATCH_SIZE)
      .map((row) => [row[1], row[2], row[3], row[4], row[6]].join('\t'))
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `
아래는 카드 사용 내역이야. 각 행은 탭으로 구분된 [날짜, 카드, 구분, 가맹점, 금액] 순서야.

규칙:
- 날짜는 YY.MM.DD 형식 → YYYY-MM-DD로 변환
- 카테고리는 반드시 다음 중 하나: 식비 / 생활·마트 / 교통 / 의료 / 문화·여가 / 교육 / 기타
- JSON 배열로만 응답하고 다른 텍스트는 포함하지 마

형식:
[{"date":"YYYY-MM-DD","card":"...","payType":"...","merchant":"...","amount":0,"category":"...","subCategory":"..."}]

데이터:
${batchText}
        `.trim(),
      }],
    });

    results.push(...JSON.parse(response.content[0].text));
    console.log(`진행: ${Math.min(i + BATCH_SIZE, dataRows.length)} / ${dataRows.length}`);
  }

  await prisma.transaction.createMany({
    data: results.map((tx) => ({ ...tx, sourceFile })),
  });

  console.log(`저장 완료: ${results.length}건`);
  await prisma.$disconnect();
}

const [, , filePath] = process.argv;
processExcel(filePath, filePath.split('/').pop());
```

**실행 방법**

```bash
node scripts/process-excel.js ./data/202602_usage.xlsx
```

---

## 6. Prisma 설정

### 설치 및 초기화

```bash
npm install prisma @prisma/client
npx prisma init
```

### 스키마 (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Transaction {
  id          Int      @id @default(autoincrement())
  date        DateTime @db.Date
  card        String   @db.VarChar(50)
  payType     String   @db.VarChar(20)
  merchant    String   @db.VarChar(255)
  amount      Int
  category    String?  @db.VarChar(50)
  subCategory String?  @db.VarChar(50)
  sourceFile  String?  @db.VarChar(100)   // 'manual' = 직접 입력
  createdAt   DateTime @default(now())

  @@index([date])
  @@index([category])
  @@map("transactions")
}
```

### 마이그레이션

```bash
npx prisma migrate dev --name init
```

### 싱글턴 인스턴스 (`src/lib/prisma.ts`)

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## 7. Server Actions

API Route 없이 서버 함수를 컴포넌트에서 직접 호출. `revalidatePath`로 저장 즉시 대시보드 갱신.

```ts
// src/actions/transactions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// 월별 조회
export async function getTransactions(month?: string) {
  if (!month) {
    return prisma.transaction.findMany({ orderBy: { date: 'desc' } });
  }
  const start = new Date(`${month}-01`);
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });
}

// 수동 항목 추가
export async function addTransaction(formData: FormData) {
  await prisma.transaction.create({
    data: {
      date:        new Date(formData.get('date') as string),
      card:        formData.get('card') as string,
      payType:     (formData.get('payType') as string) ?? '일시불',
      merchant:    formData.get('merchant') as string,
      amount:      Number(formData.get('amount')),
      category:    formData.get('category') as string,
      subCategory: (formData.get('subCategory') as string) ?? '',
      sourceFile:  'manual',
    },
  });
  revalidatePath('/chart');
}

// 항목 삭제
export async function deleteTransaction(id: number) {
  await prisma.transaction.delete({ where: { id } });
  revalidatePath('/chart');
}
```

---

## 8. 인증 (next-auth v5)

본인만 사용하는 서비스이므로 단일 비밀번호 Credentials 방식으로 구현.

### 설치

```bash
npm install next-auth@beta
```

### 설정 (`src/auth.ts`)

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        password: { label: 'Password', type: 'password' },
      },
      async authorize({ password }) {
        if (password === process.env.ADMIN_PASSWORD) {
          return { id: '1', name: 'Admin' };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: '/' },
});
```

### 미들웨어 (`middleware.ts`)

비로그인 상태에서 모든 페이지 접근 차단. 이미 로그인한 상태에서 `/` 접근 시 `/chart`로 리다이렉트.

```ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isLoginPage   = pathname === '/';
  const isPublicAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (isPublicAsset) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/chart', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 9. 프론트엔드 페이지

### 디자인 방향

- **다크모드**: 기본/전체 UI가 다크 테마 (`#080D18` 배경). 사용자 설정 또는 시스템 설정에 따른 다크모드 적용.
- Teal 포인트 컬러 (`#5EEAD4`)
- **글꼴**: Paperlogy. 글꼴 파일은 개발자가 직접 **`public/`** 폴더에 넣어서 사용 (예: `public/fonts/Paperlogy.woff2` 등).

### 9-1. 로그인 페이지 (`src/app/page.tsx`)

- 화면 중앙에 로그인 카드만 표시
- 로그인 성공 시 `/chart`로 이동
- 실패 시 인라인 에러 메시지

```tsx
'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await signIn('credentials', { password, redirect: false });
    if (result?.error) {
      setError('비밀번호가 올바르지 않습니다.');
      setLoading(false);
    } else {
      router.push('/chart');
    }
  }

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {error && <p>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '...' : '로그인'}
        </button>
      </form>
    </main>
  );
}
```

### 9-2. 사이드바 (`src/components/Sidebar.tsx`)

- 메뉴: **차트** / **내용추가** / **엑셀 추가하기**
- 현재 경로에 따라 active 스타일 적용
- 하단 로그아웃 버튼

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV = [
  { href: '/chart', label: '차트' },
  { href: '/add',   label: '내용추가' },
  { href: '/excel', label: '엑셀 추가하기' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside>
      <nav>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
            {label}
          </Link>
        ))}
      </nav>
      <button onClick={() => signOut({ callbackUrl: '/' })}>로그아웃</button>
    </aside>
  );
}
```

### 9-3. 차트 페이지 (`src/app/chart/page.tsx`)

- 좌측 사이드바 + 우측 대시보드 레이아웃
- 상단 헤더에 `‹ 2026년 2월 ›` 월 네비게이션
- 요약 카드: 총 지출 / 항목 수 / 최대 지출 카테고리
- 차트: 카테고리별 바 차트 + 비율 도넛 차트
- **월 변경 시 `key` prop이 바뀌어 컴포넌트 re-mount → D3 애니메이션 재생**

```tsx
// key를 month로 지정 → 월 변경 시 D3 useEffect가 다시 실행되어 애니메이션 재생
<BarChart
  key={`bar-${month}`}
  data={chartData}
  animationKey={month}
/>
<DonutChart
  key={`donut-${month}`}
  data={chartData}
  animationKey={month}
/>
```

### 9-4. 바 차트 (`src/components/charts/BarChart.tsx`)

D3 애니메이션: 바가 아래에서 위로 솟아오르는 효과 (`easeBackOut`)

```ts
// 핵심 애니메이션 코드
g.selectAll('.bar')
  .data(data)
  .enter()
  .append('rect')
  .attr('y', iH)        // 시작: 바닥
  .attr('height', 0)    // 시작: 높이 0
  .transition()
  .duration(700)
  .delay((_, i) => i * 55)
  .ease(d3.easeBackOut.overshoot(0.6))
  .attr('y', d => y(d.amount))           // 끝: 실제 높이
  .attr('height', d => iH - y(d.amount));
```

설치: `npm install d3 @types/d3`

### 9-5. 도넛 차트 (`src/components/charts/DonutChart.tsx`)

D3 애니메이션: 아크가 startAngle부터 endAngle까지 펼쳐지는 효과

```ts
// 핵심 애니메이션 코드
g.selectAll('.arc')
  .data(pie(data))
  .enter()
  .append('path')
  .attr('d', d => arc({ ...d, endAngle: d.startAngle }))  // 시작: 0도
  .transition()
  .duration(800)
  .delay((_, i) => i * 60)
  .ease(d3.easeCubicOut)
  .attrTween('d', function (d) {
    const interp = d3.interpolate({ ...d, endAngle: d.startAngle }, d);
    return (t) => arc(interp(t)) ?? '';
  });
```

### 9-6. 수동 추가 페이지 (`src/app/add/page.tsx`)

Server Action으로 직접 연결 → `fetch` 없이 폼 제출.

```tsx
import { addTransaction } from '@/actions/transactions';
import { redirect } from 'next/navigation';

export default function AddPage() {
  async function handleSubmit(formData: FormData) {
    'use server';
    await addTransaction(formData);
    redirect('/chart');
  }

  return (
    <form action={handleSubmit}>
      <input name="date"        type="date"   required />
      <input name="merchant"    type="text"   required />
      <input name="amount"      type="number" required />
      <select name="category">
        {['식비','생활·마트','교통','의료','문화·여가','교육','기타'].map(c =>
          <option key={c} value={c}>{c}</option>
        )}
      </select>
      <input name="card"        type="text" defaultValue="마스터034" />
      <input name="subCategory" type="text" placeholder="세부 카테고리 (선택)" />
      <select name="payType">
        <option value="일시불">일시불</option>
        <option value="할부">할부</option>
      </select>
      <button type="submit">저장하기</button>
    </form>
  );
}
```

### 9-7. 엑셀 페이지 (`src/app/excel/page.tsx`)

엑셀 파일을 업로드하여 저장하는 전용 페이지.

- **역할**: 카드사에서 받은 엑셀 파일을 선택한 뒤 저장하는 화면
- **동작**: 엑셀 파일을 넣은 뒤 **저장하기** 버튼을 누르면 `alert('저장되었습니다!')` 로 저장 완료 메시지 표시
- **사이드바**: 좌측 사이드바에 **엑셀 추가하기** 버튼(링크)으로 진입 가능 (`/excel` 경로)

#### 엑셀 업로드 후 처리 흐름 (Claude 해석 → JSON → MySQL)

업로드된 엑셀 파일의 관련 내용을 읽어, Claude 프롬프트로 해석한 뒤 JSON으로 변환하고, 그 JSON 데이터를 MySQL에 넣는 방식으로 동작한다.

1. **엑셀 업로드** — 사용자가 선택한 파일(또는 Spaces에 저장된 원본)을 읽는다.
2. **텍스트 추출** — 엑셀 시트를 탭으로 구분된 행 단위 텍스트로 만든다. (예: `xlsx` 등으로 파싱)
3. **Claude 프롬프트 호출** — 아래 프롬프트에 추출한 데이터를 넣어 호출하고, 응답으로 JSON 배열을 받는다.
4. **MySQL 저장** — 응답 JSON 배열의 각 항목을 `transactions` 테이블에 삽입한다.

**Claude 프롬프트 (카드 사용 내역 → JSON 변환)**

```
아래는 카드 사용 내역이야. 각 행은 탭으로 구분된 [날짜, 카드, 구분, 가맹점, 금액] 순서야.

규칙:
- 날짜는 YY.MM.DD 형식 → YYYY-MM-DD로 변환
- 카테고리는 반드시 다음 중 하나: 식비 / 생활·마트 / 교통 / 의료 / 문화·여가 / 교육 / 기타
- JSON 배열로만 응답하고 다른 텍스트는 포함하지 마

형식:
[{"date":"YYYY-MM-DD","card":"...","payType":"...","merchant":"...","amount":0,"category":"...","subCategory":"..."}]
```

이렇게 얻은 JSON 배열을 그대로 MySQL(Prisma `Transaction` 모델)에 넣으면 된다.

---

## 10. CI/CD (GitHub Actions)

`main` 브랜치 push 시 자동으로 Droplet에 배포.

### 워크플로우 (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Droplet

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install & Build check
        run: |
          npm ci
          npm run build
        env:
          AUTH_SECRET:       ${{ secrets.AUTH_SECRET }}
          ADMIN_PASSWORD:    ${{ secrets.ADMIN_PASSWORD }}
          DATABASE_URL:      ${{ secrets.DATABASE_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DO_SPACES_KEY:     ${{ secrets.DO_SPACES_KEY }}
          DO_SPACES_SECRET:  ${{ secrets.DO_SPACES_SECRET }}

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host:     ${{ secrets.DROPLET_HOST }}
          username: ${{ secrets.DROPLET_USER }}
          key:      ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            cd /var/www/household-budget
            git pull origin main
            npm ci --omit=dev
            npm run build
            pm2 restart household-budget --update-env
```

### GitHub Secrets 등록 목록

| Secret | 설명 |
|--------|------|
| `DROPLET_HOST` | Droplet IP 주소 |
| `DROPLET_USER` | SSH 유저명 (`root` 또는 `ubuntu`) |
| `DROPLET_SSH_KEY` | SSH 프라이빗 키 (`~/.ssh/id_rsa` 내용) |
| `AUTH_SECRET` | next-auth 시크릿 키 |
| `ADMIN_PASSWORD` | 로그인 비밀번호 |
| `DATABASE_URL` | MySQL 접속 URL |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `DO_SPACES_KEY` | DigitalOcean Spaces Access Key |
| `DO_SPACES_SECRET` | DigitalOcean Spaces Secret Key |

### pm2 초기 세팅 (Droplet에서 최초 1회)

```bash
npm install -g pm2
cd /var/www/household-budget
pm2 start npm --name "household-budget" -- start
pm2 save
pm2 startup
```

---

## 11. 환경변수 (.env)

> `.env` 파일은 절대 git에 올리지 말 것. `.gitignore`에 `.env*` 확인 필수.
> GitHub Actions에서는 동일한 값을 **Repository Secrets**에 등록해서 사용.

```env
# ── Database ──────────────────────────────────
# 형식: mysql://유저:비밀번호@호스트:포트/DB명
DATABASE_URL="mysql://root:비밀번호@localhost:3306/household_budget"

# ── next-auth v5 ──────────────────────────────
# 생성: openssl rand -base64 32
AUTH_SECRET="랜덤_32바이트_문자열"
# 로그인에 사용할 비밀번호 (직접 설정)
ADMIN_PASSWORD="내가_쓸_비밀번호"

# ── Anthropic Claude API ──────────────────────
# 발급: https://console.anthropic.com → API Keys
# 계정 이메일/비밀번호 불필요, API 키만 복사
ANTHROPIC_API_KEY="sk-ant-api03-..."

# ── DigitalOcean Spaces ───────────────────────
# 발급: DO 콘솔 → API → Spaces Keys
DO_SPACES_ENDPOINT="https://sgp1.digitaloceanspaces.com"
DO_SPACES_BUCKET="내-버킷-이름"
DO_SPACES_KEY="DO00..."
DO_SPACES_SECRET="..."
```

### 키 발급 위치

| 환경변수 | 발급 위치 | 비고 |
|---------|---------|------|
| `DATABASE_URL` | 직접 설정 | Droplet MySQL 접속 정보 |
| `AUTH_SECRET` | `openssl rand -base64 32` | 터미널에서 생성 |
| `ADMIN_PASSWORD` | 직접 설정 | 로그인 비밀번호 |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys | 계정 비밀번호 아님 |
| `DO_SPACES_ENDPOINT` | DO 콘솔 → Spaces 버킷 설정 | 리전마다 다름 (sgp1, nyc3 등) |
| `DO_SPACES_BUCKET` | DO 콘솔 → Spaces 버킷명 | |
| `DO_SPACES_KEY` | DO 콘솔 → API → Spaces Keys | |
| `DO_SPACES_SECRET` | DO 콘솔 → API → Spaces Keys | 최초 발급 시만 확인 가능 |

---

## 12. 전체 흐름 요약

```
[ 개발 ] 로컬에서 코드 작성
        ↓
[ CI/CD ] git push origin main
  → GitHub Actions: 빌드 검증 → SSH로 Droplet 접속 → pm2 restart
        ↓
[ 인증 ] middleware.ts가 모든 요청 검사
  → 비로그인 → / (로그인 페이지)
  → 로그인 성공 → /chart (대시보드)
        ↓
[ 데이터 입력 — 세 가지 경로 ]
  ① 엑셀 업로드 (웹)
       /excel 페이지 → 엑셀 파일 선택 → 저장하기 클릭 → alert('저장되었습니다!')
       (사이드바 **엑셀 추가하기** 버튼으로 진입)
       ※ 업로드된 엑셀 내용을 Claude 프롬프트로 읽어 해석 → JSON 변환 → MySQL 저장
  ② 엑셀 업로드 (스크립트)
       카드사 엑셀 다운로드
       → DigitalOcean Spaces 업로드 (원본 백업)
       → node scripts/process-excel.js 실행
          xlsx 파싱 → Claude API (날짜변환 + 카테고리분류 통합) → Prisma → MySQL
  ③ 수동 입력
       /add 폼 작성
       → Server Action (addTransaction) → Prisma → MySQL (sourceFile: 'manual')
        ↓
[ 데이터 조회 ]
  Server Action (getTransactions(month))
  → Prisma로 MySQL 조회 → Server Component에 직접 전달
        ↓
[ 시각화 ] /chart 페이지
  → 요약 카드 (총 지출 / 항목 수 / 최대 카테고리)
  → BarChart (카테고리별, 바 올라오는 애니메이션)
  → DonutChart (비율, 아크 펼쳐지는 애니메이션)
  → ‹ › 버튼으로 월 변경 → key 변경 → D3 애니메이션 재생
```

---

## 향후 확장 고려사항

- **월별 자동화**: Spaces에 파일 업로드 시 webhook 또는 cron으로 스크립트 자동 실행
- **분류 캐시**: 동일 가맹점 카테고리를 DB에 캐싱해 Claude API 호출 절감
- **편집 UI**: 잘못 분류된 항목을 차트 페이지에서 바로 수정 가능하도록
- **라인 차트 추가**: 월별 지출 추이를 한눈에 볼 수 있는 시계열 차트
- **Spaces 정리**: 처리 완료 파일은 `processed/` 폴더로 이동