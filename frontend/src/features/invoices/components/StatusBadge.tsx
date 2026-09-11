import { INVOICE_STATUS_LABELS, REMINDER_EVENT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, ReminderEventStatus } from "@/types/invoice";

const statusClasses: Record<InvoiceStatus, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SENT: "bg-accent text-accent-foreground",
  DUE: "bg-warning/15 text-warning",
  OVERDUE: "bg-destructive/10 text-destructive",
  PAID: "bg-success/10 text-success",
  CANCELLED: "bg-secondary text-secondary-foreground",
};

const dotClasses: Record<InvoiceStatus, string> = {
  DRAFT: "bg-muted-foreground",
  SENT: "bg-accent-foreground",
  DUE: "bg-warning",
  OVERDUE: "bg-destructive",
  PAID: "bg-success",
  CANCELLED: "bg-muted-foreground",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        statusClasses[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClasses[status])} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

const reminderClasses: Record<ReminderEventStatus, string> = {
  PENDING: "bg-secondary text-secondary-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  SENT: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-secondary text-secondary-foreground",
};

export function ReminderBadge({ state }: { state: ReminderEventStatus }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", reminderClasses[state])}>
      {REMINDER_EVENT_STATUS_LABELS[state]}
    </span>
  );
}
