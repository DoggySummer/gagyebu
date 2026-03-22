# DB 구조 전환: 테이블 분리 → `users` + `transactions(userId)`

> **문서 목적**: 터미널에 확인된 스키마(`users`, `transactions`에 `userId`)를 기준으로, 현재 레포의 **`transactions` / `mytransactions` 이원화**를 없앨 때 **DB·코드 쪽에서 무엇을 바꿔야 하는지**만 정리한다. (이 파일은 설명용이며, 코드 수정은 별도 작업이다.)

### `users.id` 확정 매핑

| `users.id` | 대상 | 기존 앱 문자열(`LedgerOwner`) |
| ---: | --- | --- |
| **1** | 아빠 | `appa` |
| **2** | 길웅 | `gilwoong` |

데이터 이전·시드·토글 UI를 `userId`로 바꿀 때 **위 ID를 고정 규칙**으로 쓴다.

---

## 1. 현재 레포의 DB·앱 모델 (요약)

### 1-1. Prisma (`prisma/schema.prisma`)

| 모델 | 실제 테이블 | 특징 |
| --- | --- | --- |
| `Transaction` | `transactions` | `userId` 없음. “아빠” 가계부로 사용 |
| `MyTransaction` | `mytransactions` | 동일 컬럼 구조. “길웅” 가계부 |
| `MonthlyReport` | `monthly_reports` | `(owner, monthKey)` 유니크, `owner`는 문자열 (`appa` / `gilwoong`) |

### 1-2. 앱에서의 분기

- `LedgerOwner` (`lib/ledgerOwner.ts`): `"appa" | "gilwoong"`
- Zustand `ledgerOwnerStore`: 사이드바에서 토글 → 모든 Server Action·차트·엑셀·보고서에 `owner` 인자로 전달
- `actions/transactions.ts`: `owner === "gilwoong"` 이면 `prisma.myTransaction`, 아니면 `prisma.transaction`
- `actions/processExcel.ts`: 저장 시 동일 분기
- `actions/report.ts`: `getTransactions` 재사용 + `MonthlyReport`의 `owner` 문자열

즉, **“누구 가계부인가”는 DB FK가 아니라 애플리케이션 문자열 + 물리 테이블 두 개**로 표현 중이다.

---

## 2. 목표 DB 스키마 (제공하신 `DESCRIBE` 기준)

### 2-1. `users`

- `id` (PK, auto_increment)
- `name` (varchar(50), NOT NULL)
- `createdAt` (datetime, 기본값 있음)

### 2-2. `transactions`

- `id` (PK)
- **`userId` (NOT NULL, MUL)** — `users.id` 참조 전제
- `date`, `card`, `payType`, `merchant`, `amount`, `category`, `sourceFile`, `createdAt`

**한 테이블**에 모든 사용자 거래가 들어가고, **행 단위로 `userId`로 구분**한다.

---

## 3. 현재 init.sql / Prisma와의 차이 (마이그레이션 시 주의)

제공 스키마와 레포의 기존 정의가 어긋날 수 있는 부분이다. 실제 DB에 맞춰 **한쪽으로 통일**해야 한다.

| 항목 | 현재 레포(Prisma) | 제공 `DESCRIBE` |
| --- | --- | --- |
| `transactions.userId` | 없음 | 있음 (필수) |
| `merchant` 길이 | VarChar(255) | varchar(100) |
| `category` 길이 | VarChar(50) nullable | varchar(20) nullable |
| `card` / `payType` | NOT NULL 스타일 | YES (nullable) |
| `amount` | NOT NULL | NOT NULL (동일) |

- 길이가 짧은 쪽으로 맞추면 **기존 데이터 잘림** 가능 → 운영 데이터 확인 후 `ALTER`로 확장할지 결정.
- FK: `transactions.userId` → `users(id)` 에 `ON DELETE RESTRICT` 등 정책을 Prisma `relation`과 맞출 것.

---

## 4. 데이터 마이그레이션(개념)

운영 DB에 이미 `transactions` / `mytransactions` 에 데이터가 있다면, 대략 다음 순서를 고려한다.

1. **`users` 행 확보**  
   - **`id = 1`**: 아빠, **`id = 2`**: 길웅 (`name` 등은 자유).  
   - 기존 `appa` → `userId 1`, `gilwoong` → `userId 2` (문서 상단 매핑표와 동일).

2. **`transactions` 테이블에 `userId` 컬럼 추가** (아직 없다면)  
   - 기존 “아빠” 테이블 데이터: 모두 `userId = 1` 로 백필.  
   - `mytransactions` 내용: `INSERT INTO transactions (...) SELECT ...` 형태로 옮기되 **`userId = 2`** 등으로 지정.  
   - `id` 충돌이 있으면: 한쪽 테이블 `id`를 재부여하거나, 임시 테이블에 넣은 뒤 시퀀스 정리.

3. **`mytransactions` 제거** (데이터 이전 검증 후 `DROP` 또는 Prisma에서 모델 삭제)

4. **`monthly_reports`**  
   - 현재는 `(owner, monthKey)` 문자열.  
   - 목표: **`(userId, monthKey)`** 유니크로 바꾸는 편이 자연스럽다.  
   - 기존 `owner='appa'` → **`userId=1`**, `owner='gilwoong'` → **`userId=2`** 로 일괄 변환 후 `owner` 컬럼 제거.

5. **인덱스**  
   - 조회 패턴이 `WHERE userId = ? AND date BETWEEN ...` 이므로 `(userId, date)` 복합 인덱스를 검토.

---

## 5. 코드 변경 범위 (파일 단위 체크리스트)

아래는 “어디를 손대야 하는지” 목록이다. 실제 시그니처는 구현 시 정리하면 된다.

### 5-1. Prisma & SQL

- `prisma/schema.prisma`  
  - `User` 모델 추가, `Transaction`에 `userId` + `user` 관계.  
  - `MyTransaction` / `mytransactions` 제거.  
  - `MonthlyReport`: `owner` → `userId` + `user` 관계, `@@unique([userId, monthKey])`.
- `prisma/init.sql`  
  - 단일 `transactions` 정의로 통일, `users` 생성, FK 명시.  
  - `mytransactions` 블록 제거(또는 마이그레이션 전용 주석).  
  - `monthly_reports` 스키마를 `userId` 기준으로 수정.

### 5-2. Server Actions

- `actions/transactions.ts`  
  - `LedgerOwner` / 테이블 분기 제거.  
  - 모든 쿼리에 **`where: { userId }`** (또는 세션에서 온 id).  
  - `create` / `update` / `delete` 시 **본인 `userId`만** 건드리도록 통일.  
  - 타입: `LedgerTransactionRow` 대신 단일 `Transaction` 모델.

- `actions/processExcel.ts`  
  - `owner: LedgerOwner` → **`userId: number`** (또는 서버에서 허용된 id만).  
  - `createMany` 시 각 row에 `userId` 포함, `myTransaction` 분기 삭제.

- `actions/report.ts`  
  - `getMonthlyReport` / `generateMonthlyReport` / Prisma `upsert`의 `where`를 **`userId_monthKey`** 형태로 변경.  
  - `getTransactions(month, owner)` → `getTransactions(month, userId)`.

### 5-3. 클라이언트·상태

- `lib/ledgerOwner.ts`, `lib/stores/ledgerOwnerStore.ts`  
  - **역할 변경**: 문자열 `appa`/`gilwoong` 대신 **`userId`(또는 로그인 사용자와 동기화된 id)** 를 쓰거나,  
  - “가족 공용 앱에서만 토글”이면 **허용된 `userId` 목록**(예: 1과 2)만 스토어에 두고 라벨만 “아빠꺼/길웅이꺼”로 표시.

- 다음 파일들에서 `useLedgerOwnerStore` / `ledgerOwner` 인자 전달을 **`userId` 또는 세션 기반 값**으로 교체:  
  - `app/chart/page.tsx`  
  - `app/add/page.tsx`  
  - `app/excel/page.tsx`  
  - `app/report/page.tsx`  
  - `components/Sidebar.tsx` (토글 시 `setUserId(1)` 등)  
  - `components/charts/CompareMonthChart.tsx`

### 5-4. 인증과의 관계 (`auth.ts`)

- 현재 NextAuth Credentials는 **단일 관리자**만 반환 (`id: "1"`).  
- 멀티 유저 DB와 맞추려면 선택지가 있다.  
  - **A)** 로그인 한 명만 쓰고, 토글은 여전히 “같은 계정 안에서 보기 전환” → 세션 `id`는 고정, 토글만 `userId` 변경 (권한 모델 필요: 둘 다 볼 수 있는지).  
  - **B)** 유저별 로그인 → 세션 `userId`가 곧 `transactions.userId` → 사이드바 토글 제거 또는 “다른 계정 전환”은 별도 정책.  

이 결정에 따라 **Server Action이 클라이언트가 넘긴 `userId`를 그대로 믿을지**, **세션의 id만 쓸지**가 갈린다. 보안상 **신뢰 가능한 출처는 세션**이 일반적이다.

### 5-5. 기타

- `lib/reportStats.ts`: 입력 타입은 `userId`와 무관하게 거래 배열만 받으면 그대로 둘 수 있음.  
- `report.md` / 내부 문서: `ledgerOwner` 표현을 `userId` 또는 “현재 선택 사용자”로 갱신.

---

## 6. 권장 작업 순서 (구현 시)

1. 운영 DB 백업.  
2. `users` 생성 및 시드(아빠/길웅 id 확정).  
3. `transactions`에 `userId` 추가 → 백필 → `mytransactions` 이관 → 검증 후 드롭.  
4. `monthly_reports` 스키마를 `userId` 기준으로 변경 및 데이터 변환.  
5. Prisma 스키마·클라이언트 재생성 (`prisma generate`).  
6. 위 **§5** 순서대로 액션·UI 수정 후 통합 테스트 (차트, 엑셀 업로드, 보고서, CRUD).

---

## 7. 한 줄 요약

**지금은 “테이블 두 개 + 문자열 owner”로 사용자를 구분하고, 앞으로는 “단일 `transactions` + `userId` FK”로 통일한다.**  
코드에서는 **`LedgerOwner` 분기 전부를 `userId`(및 필요 시 `User` 관계) 기준으로 합치고**, `MonthlyReport`도 **`userId` 기준 유니크**로 맞추면 된다.  
**`users.id`: 1 = 아빠, 2 = 길웅** 은 시드·마이그레이션·토글 매핑의 기준으로 고정한다.

---

## 부록: 코드 반영 현황 (이 레포)

- **`prisma/schema.prisma`**: `User`, `Transaction.userId` → `User`, `MonthlyReport.userId` → `User`, **`MyTransaction` 제거**.
- **`prisma/init.sql`**: `users` 시드(1·2), 단일 `transactions` + FK, `monthly_reports`는 `(userId, monthKey)` 유니크.
- **`lib/ledgerUser.ts`**, **`lib/stores/ledgerUserStore.ts`**: 보기 토글은 `ledgerUserId` **1 | 2**.
- **Server Actions** (`transactions`, `processExcel`, `report`) 및 **차트·추가·엑셀·보고서·사이드바·CompareMonthChart**는 위 `userId` 규약을 따름.

**기존 DB**에 예전 `transactions`(userId 없음) / `mytransactions` / `monthly_reports.owner` 가 남아 있으면 §4 순서로 **수동 마이그레이션**이 필요하다. `init.sql`만 다시 돌리면 기존 데이터와 충돌할 수 있다.
