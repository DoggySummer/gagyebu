# 리팩터링 메모 (gagyebu)

이 문서는 현재 코드베이스를 기반으로, **동작은 그대로 유지하면서** 읽기/유지보수성을 높일 수 있는 리팩터링 아이디어를 정리한 것입니다.  
우선순위가 높아 보이는 항목부터 순서대로 나열했습니다.

---

## 1. 차트 공통 로직/타입 분리

관련 파일:
- `components/charts/BarChart.tsx`
- `components/charts/DonutChart.tsx`
- `lib/constants.ts`

### 1-1. 툴팁 타입/컴포넌트 공통화

현재 바/도넛 차트 모두 거의 동일한 `TooltipState`를 각 파일 내에서 중복 정의하고 있습니다.

- 중복 정의 위치:
  - `BarChart.tsx`의 `TooltipState`
  - `DonutChart.tsx`의 `TooltipState`

**제안**
- `lib/chartTypes.ts` 또는 `components/charts/common.ts` 를 만들어:
  - `export interface ChartTooltipState { category; amount; percentage; x; y }`
  - `export type ChartDatum = ...` (이미 `lib/constants.ts`에 존재하므로 import 재사용)
- 공통 `ChartTooltip` 컴포넌트 생성:
  - 공통 스타일(테마 변수, 라운드, 그림자)을 한 곳에서 관리
  - `position: fixed` + `x, y` 좌표만 props로 전달해 재사용

효과:
- 툴팁 스타일 변경 시 한 파일만 수정하면 전체 차트에 반영.

### 1-2. 데이터 필터링/합계/퍼센트 계산 유틸화

바/도넛 차트 모두 동일한 패턴을 사용합니다.
- `amount > 0` 필터링
- 총합 `reduce`
- 각 항목의 퍼센트 `(amount / total) * 100`

**제안**
- `lib/chart-utils.ts` (또는 `lib/constants.ts` 옆) 에서:
  - `filterPositive(data: ChartDatum[]): ChartDatum[]`
  - `sumAmount(data: ChartDatum[]): number`
  - `withPercent(data: ChartDatum[]): Array<{ ...d, percentage: number }>`
  같은 함수로 공통화.

효과:
- 도메인 로직(“양수만 사용한다”, “퍼센트 계산 방식”)이 흩어지지 않고 한 곳에 모여 이해하기 쉬워짐.

### 1-3. 차트 색상 팔레트 공통화

도넛 차트에서 ORANGE 팔레트가 하드코딩 되어 있습니다.

**제안**
- `lib/chartTheme.ts` 등에 `export const ORANGE_PALETTE = [...]` 정의하고, 필요 시 다른 차트에서도 재사용.
- 향후 라인 차트, 누적 막대 등 추가 시 색상 전략을 한 곳에서 조정 가능.

---

## 2. Layout/페이지 구조 공통 패턴 정리

관련 파일:
- `app/chart/page.tsx`
- `app/add/page.tsx`
- `app/excel/page.tsx`
- `components/Sidebar.tsx`

### 2-1. 레이아웃 래퍼 컴포넌트 추출

여러 페이지에서 다음과 비슷한 구조를 반복합니다.
- `flex min-h-screen relative w-full md:max-w-[80vw] md:mx-auto`
- 좌측에 `Sidebar`, 우측에 컨텐츠 `div`

**제안**
- `components/LayoutShell.tsx` (가칭) 생성:
  - `LayoutShell({ children })` 안에서 `Sidebar` + 공통 wrapper를 렌더링.
- 각 페이지는 “페이지별 본문”만 신경 쓰도록 단순화.

효과:
- 페이지 추가/변경 시 레이아웃 관련 tailwind 클래스 재사용 → 디자인 일관성 유지.

### 2-2. 사이드바 NAV 상수 재사용

현재 `Sidebar` 내부의 `NAV` 상수는 좋은 구조이지만, URL/라벨을 다른 곳에서 참고할 수 없습니다.

**제안**
- 필요성을 느낄 경우 `lib/nav.ts` 등으로 추출:
  - `export const MAIN_NAV = [...]`
- 예: 헤더, 푸터, 모바일 메뉴 등에서 동일한 메뉴를 재사용할 수 있게 설계.

---

## 3. ChartPage 데이터 로딩/갱신 로직 정리

관련 파일:
- `app/chart/page.tsx`
- `actions/transactions.ts`
- `lib/constants.ts`

### 3-1. fetch 로직 중복 제거

`ChartPage` 에서 초기 로딩과 refetch 시에 거의 동일한 패턴을 사용합니다.
- `getTransactions(monthKey)` 호출
- `aggregateByCategory`, `getSummary` 호출
- 상태 업데이트

**제안**
- `useTransactions(monthKey)` 형태의 커스텀 훅 생성:
  - `transactions`, `chartData`, `summary`, `loading`, `refetch` 를 반환.
- 또는 컴포넌트 내부에서:
  - `async function load(monthKey)` 정의 후, `useEffect`/`refetch`에서 모두 이 함수를 사용.

효과:
- 비즈니스 로직을 한 번만 작성/검토하면 되고, 버그 여지가 줄어듦.

### 3-2. 모달 form 상태/로직 분리

`chart/page.tsx` 의 수정 모달은:
- `editingRow`, `editForm` 상태
- 폼 핸들러(onSubmit, onChange 등)
가 페이지 컴포넌트에 모두 섞여 있습니다.

**제안**
- `EditTransactionModal` 컴포넌트로 분리:
  - props: `row`, `open`, `onClose`, `onSaved`.
  - 내부에서 `editForm` 및 `onSubmit` 처리.

효과:
- `ChartPage`는 “목록 + 차트 + 모달 열기/닫기” 역할만 담당 → 가독성 향상.

---

## 4. 서버 액션/도메인 계층 정리

관련 파일:
- `actions/transactions.ts`
- `actions/processExcel.ts`
- `lib/prisma.ts`
- `prisma/schema.prisma` (간접적으로)

### 4-1. 도메인 서비스 레이어 초안

현재 서버 액션에서 바로 `prisma.transaction.*` 를 호출하고 있습니다.
규모가 크지 않으므로 지금도 문제는 없지만, 다음 구조로 확장 여지를 만들 수 있습니다.

**제안**
- `lib/services/transactionService.ts` (가칭):
  - `listByMonth(monthKey)`, `addFromForm(formData)`, `updateFromEditForm(id, data)` 등 정의.
- 서버 액션은 “HTTP/폼 입력 → 서비스 호출 → revalidatePath” 역할만 하도록 단순화.

효과:
- 나중에 비즈니스 규칙이 늘어나도 서비스 레이어에서만 관리 가능.

### 4-2. 엑셀 파싱/Claude 호출 로직 분리

`processExcelAndSave` 안에:
- 엑셀 파싱
- 텍스트 변환
- Claude 호출/JSON 파싱
- DB 저장
이 모두 들어 있습니다.

**제안**
- 최소한 함수 단위로 분리:
  - `parseExcelToRows(file)`, `rowsToPromptBatches(rows)`, `callClaudeForBatch(batchText)`, `saveTransactions(rows, sourceFile)` 등.

효과:
- 에러 발생 시 어느 단계에서 실패했는지 파악하기 쉬워짐.
- 테스트 코드(있을 경우) 작성이 쉬워짐.

---

## 5. 타입/에러 처리·UX 개선 여지

### 5-1. Excel 업로드 에러 메시지 개선

관련 파일:
- `app/excel/page.tsx`
- `actions/processExcel.ts`

현재:
- 서버에서 비교적 상세한 메시지를 생성하지만, 클라이언트에서는 대부분 `"오류가 발생했습니다."`만 alert로 보여줌.

**제안**
- `result.error` 를 그대로(또는 안전한 형태로) alert에 노출하거나, 화면 상단에 에러 박스로 출력.
- “엑셀 형식이 맞지 않습니다”, “AI 키가 설정되지 않았습니다” 등을 사용자에게 직접 안내.

### 5-2. 로그인 UX

관련 파일:
- `app/page.tsx`
- `auth.ts`

아이디어:
- 로그인 실패 시 이미 “비밀번호가 올바르지 않습니다.”라는 좋은 메시지가 있으므로, 실패 횟수 제한이나 간단한 지연(예: 300ms)으로 브루트포스 완화도 고려 가능.

---

## 6. 스타일/유틸 정리

관련 파일:
- `app/globals.css`
- 컴포넌트 전반의 `className` 문자열

아이디어:
- 버튼/카드/인풋에 사용되는 Tailwind 클래스가 전반적으로 일관성이 좋은 편입니다.
- 추후:
  - `btn-primary`, `card`, `input-dark` 같은 유틸 클래스를 더 체계적으로 묶고 싶다면, `@apply` 나 React 컴포넌트 래퍼(`<Button>`, `<Card>`)로 추출하는 방향 검토.

---

## 7. 차트 고급화 여지 (선택)

현재 차트는:
- 월별 카테고리 합계를 잘 보여 주고 있음.

추가 아이디어 (기능 확장 중심, 필수 아님):
- 최근 n개월 라인 차트 추가 (카테고리별 트렌드).
- 바 차트에서 카테고리 클릭 시 해당 카테고리만 필터링된 테이블 뷰 연동.

이 부분은 기능 확장에 가까우므로, 우선순위가 낮다면 보류해도 됩니다.

