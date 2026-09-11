export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface ReminderStep {
  id: string;
  stepOrder: number;
  delayDays: number;
  emailTemplateId: string;
  emailTemplate: EmailTemplate;
}

/** Named `ReminderSequence` to match the backend — the UI still calls this "Automations". */
export interface ReminderSequence {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: ReminderStep[];
  createdAt: string;
  updatedAt: string;
}
