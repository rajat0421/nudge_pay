export interface TemplateVariables {
  client_name: string;
  company_name: string;
  invoice_number: string;
  amount: string;
  due_date: string;
  payment_url: string;
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in variables ? String(variables[key as keyof TemplateVariables]) : match,
  );
}

/** Templates are authored as plain text; wrap for a minimally-styled HTML body. */
export function toHtml(plainTextBody: string): string {
  const escaped = plainTextBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family: -apple-system, sans-serif; white-space: pre-wrap; line-height: 1.5; color: #1a1a1a;">${escaped}</div>`;
}

/**
 * Default sequence used by the seed script. Tone is always professional and
 * friendly — never threatening or aggressive collection language.
 */
export const DEFAULT_TEMPLATES = [
  {
    name: "Friendly reminder",
    delayDays: 2,
    subject: "Quick nudge on invoice {{invoice_number}}",
    body: "Hi {{client_name}},\n\nJust a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}.\n\nYou can take care of it here: {{payment_url}}\n\nThanks so much,\n{{company_name}}",
  },
  {
    name: "Second reminder",
    delayDays: 7,
    subject: "Invoice {{invoice_number}} is now overdue",
    body: "Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount}} was due on {{due_date}} and still shows as unpaid. If it's already been taken care of, please disregard this — otherwise here's the link: {{payment_url}}\n\nThanks,\n{{company_name}}",
  },
  {
    name: "Final reminder",
    delayDays: 14,
    subject: "Final reminder — invoice {{invoice_number}}",
    body: "Hi {{client_name}},\n\nThis is a final reminder that invoice {{invoice_number}} for {{amount}} (originally due {{due_date}}) is still outstanding. Please arrange payment when you're able to: {{payment_url}}\n\nIf anything's holding this up, just reply and let us know — happy to help.\n\nThanks,\n{{company_name}}",
  },
] as const;
