import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { ReminderBadge, StatusBadge } from "@/features/invoices/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { automations } from "@/lib/mock-db";
import { useInvoiceStore } from "@/store/invoiceStore";

export const Route = createFileRoute("/invoices/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Invoice detail — Remindly" },
      {
        name: "description",
        content:
          "Review one invoice: amount, due date, payment link and the full timeline of reminders sent or scheduled.",
      },
      { property: "og:title", content: "Invoice detail — Remindly" },
      {
        property: "og:description",
        content: "Invoice summary with its complete reminder timeline.",
      },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const invoice = useInvoiceStore((s) => s.invoices.find((i) => i.id === invoiceId));
  const markPaid = useInvoiceStore((s) => s.markPaid);

  if (!invoice) {
    return (
      <AppLayout title="Invoice">
        <PageContainer>
          <EmptyState
            title="Invoice not found"
            description="It may have been removed."
            action={
              <Button asChild variant="outline">
                <Link to="/invoices">Back to invoices</Link>
              </Button>
            }
          />
        </PageContainer>
      </AppLayout>
    );
  }

  const automation = automations.find((a) => a.id === invoice.automationId);

  return (
    <AppLayout title={invoice.number}>
      <PageContainer>
        <Link
          to="/invoices"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Invoices
        </Link>

        <PageHeading
          title={`${invoice.number} · ${invoice.customerName}`}
          description={`Due ${formatDate(invoice.dueDate)} · sequence "${automation?.name ?? "None"}"`}
          actions={
            invoice.status !== "paid" ? (
              <ConfirmDialog
                trigger={<Button>Mark paid</Button>}
                title={`Mark ${invoice.number} as paid?`}
                description="This stops all scheduled reminders for this invoice immediately."
                confirmLabel="Mark paid"
                onConfirm={() => {
                  markPaid(invoice.id);
                  toast.success(`${invoice.number} marked paid — reminders stopped`);
                }}
              />
            ) : (
              <StatusBadge status="paid" />
            )
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <Row label="Status" value={<StatusBadge status={invoice.status} />} />
            <Row
              label="Amount"
              value={
                <span className="nums font-semibold">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </span>
              }
            />
            <Row label="Issued" value={formatDate(invoice.issueDate)} />
            <Row label="Due" value={formatDate(invoice.dueDate)} />
            <Row label="Client" value={invoice.customerName} />
            {invoice.paymentUrl && (
              <a
                href={invoice.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Payment link
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <h3 className="text-base font-semibold">Reminder timeline</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Offsets are counted from the due date.
            </p>

            {invoice.reminders.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                No reminders scheduled yet — this invoice is still a draft.
              </p>
            ) : (
              <ol className="mt-5 space-y-5 border-l border-border pl-5">
                {invoice.reminders.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        Step {r.step} · {r.label}
                      </p>
                      <ReminderBadge state={r.state} />
                    </div>
                    <p className="nums mt-0.5 text-xs text-muted-foreground">
                      +{r.offsetDays} days · {formatDate(r.date)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
