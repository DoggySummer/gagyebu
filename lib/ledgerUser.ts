/** 가계부 보기 대상: users.id (database.md — 1 아빠, 2 길웅) */
export const LEDGER_USER_DAD = 1 as const;
export const LEDGER_USER_GILWOONG = 2 as const;

export type LedgerUserId = typeof LEDGER_USER_DAD | typeof LEDGER_USER_GILWOONG;

export function isLedgerUserId(id: number): id is LedgerUserId {
  return id === LEDGER_USER_DAD || id === LEDGER_USER_GILWOONG;
}

export function requireLedgerUserId(id: number): LedgerUserId {
  if (!isLedgerUserId(id)) {
    throw new Error("유효하지 않은 가계부 사용자입니다.");
  }
  return id;
}
