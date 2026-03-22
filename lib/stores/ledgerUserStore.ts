import { create } from "zustand";
import type { LedgerUserId } from "@/lib/ledgerUser";
import { LEDGER_USER_DAD } from "@/lib/ledgerUser";

export type { LedgerUserId } from "@/lib/ledgerUser";

interface LedgerUserState {
  ledgerUserId: LedgerUserId;
  setLedgerUserId: (id: LedgerUserId) => void;
}

export const useLedgerUserStore = create<LedgerUserState>((set) => ({
  ledgerUserId: LEDGER_USER_DAD,
  setLedgerUserId: (id) => set({ ledgerUserId: id }),
}));
