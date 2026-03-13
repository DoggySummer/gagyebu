# 가계부 (gagyebu)

카드사 엑셀을 Claude API로 파싱·분류해 MySQL에 저장하고, Next.js + D3로 월별 지출을 보는 개인 가계부 웹 앱입니다.

---

## 목차

- [기능 요약](#기능-요약)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [실행 방법](#실행-방법)
- [데이터 흐름](#데이터-흐름)
- [환경 변수](#환경-변수)
- [배포 (GitHub Actions)](#배포-github-actions)
- [인프라·운영 참고](#인프라운영-참고)

---

## 기능 요약

| 기능 | 설명 |
|------|------|
| **로그인** | 단일 비밀번호(Credentials) 인증, next-auth v5 |
| **차트** | 월별 총 지출·항목 수·최대 카테고리, D3 바/도넛 차트, 월 이동 시 애니메이션 |
| **거래 목록** | AG Grid 테이블(날짜·가맹점·금액·카테고리·하위카테고리·카드·구분), **수정·삭제** 버튼으로 편집 |
| **수동 추가** | `/add`에서 날짜·가맹점·금액·카테고리 등 직접 입력 후 저장 |
| **엑셀 추가** | `/excel`에서 엑셀 업로드 → Claude가 행별 해석 → JSON → MySQL 저장, 저장 후 건수 알림 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 스타일 | Tailwind CSS 4 |
| DB·ORM | MySQL, Prisma (MariaDB adapter 사용 가능) |
| 인증 | next-auth v5 (Credentials) |
| AI | Anthropic Claude API (엑셀 행 해석) |
| 차트 | D3.js |
| 테이블 | AG Grid (거래 목록) |
| 엑셀 | xlsx |
| 배포 | GitHub Actions → SSH → Droplet, pm2 |

---

## 프로젝트 구조

```
gagyebu/
├── app/
│   ├── layout.tsx          # 루트 레이아웃, AG Grid CSS, Providers
│   ├── page.tsx            # 로그인 (메인)
│   ├── globals.css         # Tailwind, 폰트(Paperlogy), 테마 변수
│   ├── chart/page.tsx      # 차트 대시보드 + 거래 목록(AG Grid) + 수정/삭제 모달
│   ├── add/page.tsx        # 수동 지출 추가 폼
│   ├── excel/page.tsx      # 엑셀 업로드·저장
│   └── api/auth/[...nextauth]/route.ts
├── components/
│   ├── Sidebar.tsx         # 좌측 네비(차트/내용추가/엑셀), 로그아웃, 모바일 드로어
│   ├── Providers.tsx      # NextAuth SessionProvider
│   └── charts/
│       ├── BarChart.tsx    # 카테고리별 지출 바 차트 (반응형)
│       ├── DonutChart.tsx  # 비율 도넛 차트
│       └── TransactionActionsCell.tsx  # 거래 목록 수정/삭제 버튼 셀
├── actions/
│   ├── transactions.ts    # getTransactions, addTransaction, updateTransaction, deleteTransaction
│   ├── processExcel.ts     # 엑셀 파싱 → Claude → DB 저장 (Server Action)
│   └── uploadExcel.ts
├── lib/
│   ├── prisma.ts           # Prisma 싱글턴
│   └── constants.ts       # CATEGORIES, aggregateByCategory, getSummary
├── prisma/
│   ├── schema.prisma       # Transaction 모델
│   └── init.sql
├── auth.ts                 # next-auth 설정 (Credentials, ADMIN_PASSWORD)
├── .github/workflows/
│   └── deploy.yml          # main push 시 빌드 검증 → SSH 배포 → pm2 restart
└── .env                    # DATABASE_URL, AUTH_SECRET, ADMIN_PASSWORD, ANTHROPIC_API_KEY 등
```

- **경로**: `src/` 없이 루트에 `app/`, `components/`, `actions/`, `lib/` 사용.
- **엑셀 처리**: 별도 CLI 스크립트 대신 웹의 **엑셀 추가하기** 페이지에서 Server Action(`processExcel.ts`)으로 처리.

---

## 실행 방법

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성 (schema.prisma 기준)
npx prisma generate

# 개발 서버 (필요 시 .env 설정)
npm run dev
```

- 로그인: 브라우저에서 `/` 접속 후 `.env`의 `ADMIN_PASSWORD`로 로그인.
- 로그인 성공 시 `/chart`로 이동.

---

## 데이터 흐름

1. **엑셀 추가**  
   `app/excel/page.tsx` → `actions/processExcel.ts`:  
   엑셀 시트를 읽어 행 단위 텍스트로 만든 뒤, Claude 프롬프트로 `date/card/payType/merchant/amount/category/subCategory` JSON 배열 생성 → Prisma `transaction.createMany`로 저장.

2. **수동 추가**  
   `app/add/page.tsx` → `actions/transactions.ts`의 `addTransaction`:  
   폼 데이터로 `transaction.create`, `sourceFile: 'manual'`.

3. **차트·거래 목록**  
   `app/chart/page.tsx` → `getTransactions(monthKey)`로 월별 조회 → D3로 카테고리별 집계·차트, AG Grid로 테이블 표시.  
   **수정**: 모달에서 가맹점·금액·카테고리·하위카테고리 변경 후 저장 → `updateTransaction`.  
   **삭제**: 행의 삭제 버튼 → `deleteTransaction(id)`.

4. **인증**  
   `auth.ts` + `app/api/auth/[...nextauth]/route.ts` + (필요 시) 미들웨어에서 비로그인 시 로그인 페이지로 리다이렉트.

---

## 환경 변수

`.env` 예시 (git에 올리지 말 것).

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | MySQL 접속 URL (예: `mysql://user:pass@localhost:3306/dbname`) |
| `AUTH_SECRET` | next-auth 시크릿 (예: `openssl rand -base64 32`) |
| `ADMIN_PASSWORD` | 로그인 비밀번호 |
| `ANTHROPIC_API_KEY` | Claude API 키 (엑셀 해석용) |
| `DO_SPACES_KEY` / `DO_SPACES_SECRET` | DigitalOcean Spaces 사용 시 |

배포 시 동일 값은 GitHub Repository Secrets에 등록해 워크플로에서 사용.

---

## 배포 (GitHub Actions)

- **파일**: `.github/workflows/deploy.yml`
- **트리거**: `main` 브랜치 push 시
- **순서**:  
  1) Checkout → Node 20 설정 → `npm ci` → `npm run build` (빌드 검증)  
  2) SSH로 Droplet 접속 → `cd $APP_DIR` → `git pull origin main` → `npm ci` → `npm run build` → `pm2 restart gagyebu --update-env`

**필요 Secrets**:  
`DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`, `DROPLET_SSH_KEY_PASSPHRASE`(선택),  
`AUTH_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`, `ANTHROPIC_API_KEY`,  
`DO_SPACES_KEY`, `DO_SPACES_SECRET`(사용 시).  
서버 경로는 `APP_DIR` 시크릿으로 지정 가능(기본값 예시는 워크플로 내 주석 참고).

**주의**: 서버에서 빌드할 때 Tailwind/PostCSS가 필요하므로 `npm ci`는 `--omit=dev` 없이 실행.

---

## 인프라·운영 참고

- **Droplet**: Next.js + MySQL 동시 운영 시 메모리 부족 방지를 위해 Swap 설정, MySQL `innodb_buffer_pool_size` 등 조정 권장.
- **Nginx**: 로그인 등 API에 rate limiting 적용 시 브루트포스 완화 가능 (burst 너무 낮으면 정상 로그인도 503 가능).
- **pm2**: 최초 1회 `pm2 start npm --name gagyebu -- start`, `pm2 save`, `pm2 startup` 설정.

---

## 라이선스·기타

- 개인 사용 목적 가계부 프로젝트입니다.
- 확장 아이디어: 월별 자동화, 가맹점별 카테고리 캐시, 라인 차트 등은 README에만 언급하며, 구현은 코드베이스 기준입니다.
