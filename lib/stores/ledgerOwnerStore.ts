import { create } from "zustand";
import type { LedgerOwner } from "@/lib/ledgerOwner";

export type { LedgerOwner } from "@/lib/ledgerOwner";

interface LedgerOwnerState {
  ledgerOwner: LedgerOwner;
  setLedgerOwner: (owner: LedgerOwner) => void;
}

export const useLedgerOwnerStore = create<LedgerOwnerState>((set) => ({
  ledgerOwner: "appa",
  setLedgerOwner: (owner) => set({ ledgerOwner: owner }),
}));
