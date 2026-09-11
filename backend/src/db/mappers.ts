/**
 * Row shapes + date hydration for every table. PostgREST (what
 * @supabase/supabase-js talks to) returns timestamptz columns as ISO
 * strings, not JS Date objects. These mappers convert each table's own
 * date columns back into Date
 * objects at the repository boundary, so services/jobs/tests written
 * against `Date`-typed fields (`.getTime()`, date-fns, etc.) don't need to
 * change at all. Each mapper only touches its own table's columns; nested
 * embeds (client, organization, steps, ...) are mapped explicitly by
 * whichever repository function requested them.
 */

export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMemberRow {
  id: string;
  organizationId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: Date;
}

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  createdAt: Date;
}

export interface ClientRow {
  id: string;
  organizationId: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderSequenceRow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateRow {
  id: string;
  organizationId: string;
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderStepRow {
  id: string;
  reminderSequenceId: string;
  stepOrder: number;
  delayDays: number;
  emailTemplateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";

export interface InvoiceRow {
  id: string;
  organizationId: string;
  clientId: string;
  reminderSequenceId: string | null;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paymentUrl: string | null;
  status: InvoiceStatus;
  paidAt: Date | null;
  remindersPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ReminderEventStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export interface ReminderEventRow {
  id: string;
  organizationId: string;
  invoiceId: string;
  reminderStepId: string;
  scheduledAt: Date;
  sentAt: Date | null;
  status: ReminderEventStatus;
  attempts: number;
  providerMessageId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogRow {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

function toDate(value: unknown): Date;
function toDate(value: null | undefined): null;
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value as string);
}

export function mapUser(row: Record<string, unknown>): UserRow {
  return {
    ...(row as unknown as UserRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastLoginAt: toDate(row.lastLoginAt as string | null),
  };
}

export function mapOrganization(row: Record<string, unknown>): OrganizationRow {
  return {
    ...(row as unknown as OrganizationRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapOrganizationMember(row: Record<string, unknown>): OrganizationMemberRow {
  return {
    ...(row as unknown as OrganizationMemberRow),
    createdAt: toDate(row.createdAt),
  };
}

export function mapRefreshToken(row: Record<string, unknown>): RefreshTokenRow {
  return {
    ...(row as unknown as RefreshTokenRow),
    expiresAt: toDate(row.expiresAt),
    revokedAt: toDate(row.revokedAt as string | null),
    createdAt: toDate(row.createdAt),
  };
}

export function mapClient(row: Record<string, unknown>): ClientRow {
  return {
    ...(row as unknown as ClientRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapReminderSequence(row: Record<string, unknown>): ReminderSequenceRow {
  return {
    ...(row as unknown as ReminderSequenceRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapEmailTemplate(row: Record<string, unknown>): EmailTemplateRow {
  return {
    ...(row as unknown as EmailTemplateRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapReminderStep(row: Record<string, unknown>): ReminderStepRow {
  return {
    ...(row as unknown as ReminderStepRow),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapReminderStepWithTemplate(
  row: Record<string, unknown>,
): ReminderStepRow & { emailTemplate: EmailTemplateRow } {
  return {
    ...mapReminderStep(row),
    emailTemplate: mapEmailTemplate(row.emailTemplate as Record<string, unknown>),
  };
}

export function mapReminderSequenceWithSteps(
  row: Record<string, unknown>,
): ReminderSequenceRow & { steps: Array<ReminderStepRow & { emailTemplate: EmailTemplateRow }> } {
  const steps = ((row.steps as Array<Record<string, unknown>>) ?? [])
    .map(mapReminderStepWithTemplate)
    .sort((a, b) => a.stepOrder - b.stepOrder);
  return { ...mapReminderSequence(row), steps };
}

export function mapInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    ...(row as unknown as InvoiceRow),
    issueDate: toDate(row.issueDate),
    dueDate: toDate(row.dueDate),
    paidAt: toDate(row.paidAt as string | null),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapInvoiceWithClient(row: Record<string, unknown>): InvoiceRow & { client: ClientRow } {
  return { ...mapInvoice(row), client: mapClient(row.client as Record<string, unknown>) };
}

export function mapReminderEvent(row: Record<string, unknown>): ReminderEventRow {
  return {
    ...(row as unknown as ReminderEventRow),
    scheduledAt: toDate(row.scheduledAt),
    sentAt: toDate(row.sentAt as string | null),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export function mapReminderEventWithStep(
  row: Record<string, unknown>,
): ReminderEventRow & { reminderStep: ReminderStepRow } {
  return {
    ...mapReminderEvent(row),
    reminderStep: mapReminderStep(row.reminderStep as Record<string, unknown>),
  };
}

export function mapAuditLog(row: Record<string, unknown>): AuditLogRow {
  return { ...(row as unknown as AuditLogRow), createdAt: toDate(row.createdAt) };
}
