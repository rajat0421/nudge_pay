export interface AutomationStep {
  id: string;
  offsetDays: number;
  channel: "email";
  subject: string;
  body: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: "due_date" | "issue_date";
  steps: AutomationStep[];
  invoicesAttached: number;
  recoveredAmount: number;
}
