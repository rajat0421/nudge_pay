import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, ReminderState } from "@/types/invoice";

const statusClasses: Record<InvoiceStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-accent text-accent-foreground",
  overdue: "bg-destructive/10 text-destructive",
  paid: "bg-success/10 text-success",
};

const dotClasses: Record<InvoiceStatus, string> = {
  draft: "bg-muted-foreground",
  sent: "bg-warning",
  overdue: "bg-destructive",
  paid: "bg-success",
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

const reminderClasses: Record<ReminderState, string> = {
  sent: "bg-success/10 text-success",
  scheduled: "bg-secondary text-secondary-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export function ReminderBadge({ state }: { state: ReminderState }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        reminderClasses[state],
      )}
    >
      {state}
    </span>
  );
}
