import { create } from "zustand";
import { automations as seedAutomations } from "@/lib/mock-db";
import type { Automation } from "@/types/automation";

interface AutomationState {
  automations: Automation[];
  toggleActive: (id: string) => void;
  updateStep: (
    automationId: string,
    stepId: string,
    patch: Partial<Automation["steps"][number]>,
  ) => void;
}

export const useAutomationStore = create<AutomationState>((set) => ({
  automations: seedAutomations,
  toggleActive: (id) =>
    set((s) => ({
      automations: s.automations.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    })),
  updateStep: (automationId, stepId, patch) =>
    set((s) => ({
      automations: s.automations.map((a) =>
        a.id === automationId
          ? { ...a, steps: a.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) }
          : a,
      ),
    })),
}));
