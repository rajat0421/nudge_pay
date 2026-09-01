export interface ReminderPresetStep {
  delayDays: number;
  subject: string;
  body: string;
}

export interface ReminderPreset {
  key: "friendly" | "aggressive";
  label: string;
  description: string;
  steps: ReminderPresetStep[];
}

const FRIENDLY_STEPS: ReminderPresetStep[] = [
  {
    delayDays: 2,
    subject: "Quick nudge on invoice {{invoice_number}}",
    body: "Hi {{client_name}},\n\nJust a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}.\n\nYou can take care of it here: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
  {
    delayDays: 7,
    subject: "Invoice {{invoice_number}} is now overdue",
    body: "Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount}} was due on {{due_date}} and still shows as unpaid. If it's already been taken care of, please disregard — otherwise here's the link: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
  {
    delayDays: 14,
    subject: "Final reminder — invoice {{invoice_number}}",
    body: "Hi {{client_name}},\n\nThis is a final reminder that invoice {{invoice_number}} for {{amount}} (originally due {{due_date}}) is still outstanding. Please arrange payment when you're able to: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
];

const AGGRESSIVE_STEPS: ReminderPresetStep[] = [
  {
    delayDays: 1,
    subject: "Invoice {{invoice_number}} was due yesterday",
    body: "Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now overdue.\n\nYou can pay here: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
  {
    delayDays: 3,
    subject: "Second reminder — invoice {{invoice_number}}",
    body: "Hi {{client_name}},\n\nFollowing up again on invoice {{invoice_number}} for {{amount}}, due {{due_date}}. Please arrange payment as soon as you can: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
  {
    delayDays: 7,
    subject: "Action needed — invoice {{invoice_number}} is a week overdue",
    body: "Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount}} is now a week past its {{due_date}} due date. Please settle it at your earliest convenience: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
];

export const REMINDER_PRESETS: ReminderPreset[] = [
  {
    key: "friendly",
    label: "Friendly",
    description: "2, 7 and 14 days after the due date — a gentle three-step chase.",
    steps: FRIENDLY_STEPS,
  },
  {
    key: "aggressive",
    label: "Aggressive",
    description: "1, 3 and 7 days after the due date — for clients who need a firmer nudge.",
    steps: AGGRESSIVE_STEPS,
  },
];

export function buildCustomSteps(delays: [number, number, number]): ReminderPresetStep[] {
  return delays.map((delayDays, index) => ({
    delayDays,
    subject:
      index === delays.length - 1
        ? "Final reminder — invoice {{invoice_number}}"
        : `Reminder ${index + 1} — invoice {{invoice_number}}`,
    body: "Hi {{client_name}},\n\nJust a reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}.\n\nYou can take care of it here: {{payment_url}}\n\nThanks,\n{{company_name}}",
  }));
}
