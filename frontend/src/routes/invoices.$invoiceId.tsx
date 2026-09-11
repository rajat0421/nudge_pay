import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { ReminderBadge, StatusBadge } from "@/features/invoices/components/StatusBadge";
import {
  getInvoice,
  markInvoicePaid,
  pauseInvoiceReminders,
  resumeInvoiceReminders,
} from "@/features/invoices/services/invoice.service";
import { formatCurrency, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/invoices/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Invoice detail — NudgePay" },
      {
        name: "description",
        content:
          "Review one invoice: amount, due date, payment link and the full timeline of reminders sent or scheduled.",
      },
      { property: "og:title", content: "Invoice detail — NudgePay" },
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
  const queryClient = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () => getInvoice(invoiceId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const markPaidMutation = useMutation({
    mutationFn: () => markInvoicePaid(invoiceId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoices", invoiceId], updated);
      invalidate();
      toast.success(`${updated.invoiceNumber} marked paid — reminders stopped`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not mark invoice paid");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseInvoiceReminders(invoiceId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoices", invoiceId], updated);
      invalidate();
      toast.success("Reminders paused");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not pause reminders");
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeInvoiceReminders(invoiceId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["invoices", invoiceId], updated);
      invalidate();
      toast.success("Reminders resumed");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not resume reminders");
    },
  });

  if (invoiceQuery.isLoading) {
    return (
      <AppLayout title="Invoice">
        <PageContainer>
          <LoadingState rows={4} />
        </PageContainer>
      </AppLayout>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    const notFound = invoiceQuery.error instanceof ApiError && invoiceQuery.error.status === 404;
    return (
      <AppLayout title="Invoice">
        <PageContainer>
          {notFound ? (
            <EmptyState
              title="Invoice not found"
              description="It may have been removed."
              action={
                <Button asChild variant="outline">
                  <Link to="/invoices">Back to invoices</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState onRetry={() => invoiceQuery.refetch()} />
          )}
        </PageContainer>
      </AppLayout>
    );
  }

  const invoice = invoiceQuery.data;
  const canPause = invoice.status !== "PAID" && invoice.status !== "CANCELLED";

  return (
    <AppLayout title={invoice.invoiceNumber}>
      <PageContainer>
        <Link
          to="/invoices"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Invoices
        </Link>

        <PageHeading
          title={`${invoice.invoiceNumber} · ${invoice.client?.name ?? "Unknown client"}`}
          description={`Due ${formatDate(invoice.dueDate)} · sequence "${invoice.reminderSequence?.name ?? "None"}"`}
          actions={
            <div className="flex items-center gap-2">
              {invoice.status === "PAID" ? (
                <StatusBadge status="PAID" />
              ) : (
                <>
                  {canPause &&
                    (invoice.remindersPaused ? (
                      <Button
                        variant="outline"
                        onClick={() => resumeMutation.mutate()}
                        disabled={resumeMutation.isPending}
                      >
                        <PlayCircle className="size-4" />
                        Resume reminders
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => pauseMutation.mutate()}
                        disabled={pauseMutation.isPending}
                      >
                        <PauseCircle className="size-4" />
                        Pause reminders
                      </Button>
                    ))}
                  <ConfirmDialog
                    trigger={<Button disabled={markPaidMutation.isPending}>Mark paid</Button>}
                    title={`Mark ${invoice.invoiceNumber} as paid?`}
                    description="This stops all scheduled reminders for this invoice immediately."
                    confirmLabel="Mark paid"
                    onConfirm={() => markPaidMutation.mutate()}
                  />
                </>
              )}
            </div>
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
            <Row label="Client" value={invoice.client?.name ?? "—"} />
            {invoice.remindersPaused && invoice.status !== "PAID" && (
              <Row label="Reminders" value="Paused" />
            )}
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
              Scheduled dates are shown in your organization's timezone.
            </p>

            {invoice.reminderEvents.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                No reminders scheduled yet for this invoice.
              </p>
            ) : (
              <ol className="mt-5 space-y-5 border-l border-border pl-5">
                {invoice.reminderEvents.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Step {r.reminderStep.stepOrder}</p>
                      <ReminderBadge state={r.status} />
                    </div>
                    <p className="nums mt-0.5 text-xs text-muted-foreground">
                      +{r.reminderStep.delayDays} days ·{" "}
                      {formatDate(r.sentAt ?? r.scheduledAt)}
                    </p>
                    {r.lastError && (
                      <p className="mt-0.5 text-xs text-destructive">{r.lastError}</p>
                    )}
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
