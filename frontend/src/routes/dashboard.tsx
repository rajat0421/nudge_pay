import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, CheckCircle2, Send, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { InvoiceTable } from "@/features/invoices/components/InvoiceTable";
import { getDashboardSummary, getOverdueInvoices, getRecentActivity } from "@/features/dashboard/services/dashboard.service";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NudgePay" },
      {
        name: "description",
        content:
          "See outstanding, overdue and collected invoice totals at a glance, plus every reminder NudgePay sent on your behalf.",
      },
      { property: "og:title", content: "Dashboard — NudgePay" },
      {
        property: "og:description",
        content: "Outstanding, overdue and collected totals with automated reminder activity.",
      },
    ],
  }),
  component: DashboardPage,
});

function activityLine(item: ReturnType<typeof useRecentActivityShape>[number]) {
  const clientLabel = item.invoice.client?.name ?? "a client";
  if (item.status === "SENT") {
    return {
      title: `Reminder sent — ${item.invoice.invoiceNumber}`,
      detail: `Step ${item.reminderStep.stepOrder} delivered to ${clientLabel}`,
    };
  }
  if (item.status === "FAILED") {
    return {
      title: `Reminder failed — ${item.invoice.invoiceNumber}`,
      detail: item.lastError ?? `Delivery to ${clientLabel} failed`,
    };
  }
  return { title: `${item.invoice.invoiceNumber} activity`, detail: clientLabel };
}

// Purely for TypeScript inference in activityLine's parameter above.
function useRecentActivityShape() {
  return [] as Awaited<ReturnType<typeof getRecentActivity>>["items"];
}

function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
  });
  const overdueQuery = useQuery({
    queryKey: ["dashboard", "overdue", { limit: 5 }],
    queryFn: () => getOverdueInvoices({ limit: 5 }),
  });
  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", { limit: 4 }],
    queryFn: () => getRecentActivity({ limit: 4 }),
  });

  const summary = summaryQuery.data;

  return (
    <AppLayout title="Dashboard">
      <PageContainer>
        <PageHeading
          title={user ? `Good evening, ${user.name}` : "Dashboard"}
          description="Track outstanding invoices and every reminder NudgePay has sent on your behalf."
          actions={
            <Button variant="outline" asChild>
              <Link to="/automations">
                Review automations
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          }
        />

        {summaryQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : summaryQuery.isError ? (
          <ErrorState onRetry={() => summaryQuery.refetch()} />
        ) : summary ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Outstanding"
              value={formatCurrency(summary.outstandingAmount)}
              delta={`${summary.totalInvoices} invoices tracked`}
              icon={Wallet}
            />
            <KpiCard
              label="Overdue"
              value={formatCurrency(summary.overdueAmount)}
              delta={`${summary.overdueCount} invoices past due`}
              tone={summary.overdueCount > 0 ? "negative" : "neutral"}
              icon={AlertCircle}
            />
            <KpiCard
              label="Paid this month"
              value={formatCurrency(summary.paidThisMonth)}
              tone="positive"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Due soon"
              value={String(summary.upcomingDueInvoices.length)}
              delta="Sent or due invoices"
              icon={Send}
            />
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-end justify-between">
              <h3 className="text-base font-semibold">Needs attention</h3>
              <Link to="/invoices" className="text-sm text-primary hover:underline">
                All invoices
              </Link>
            </div>
            {overdueQuery.isLoading ? (
              <LoadingState rows={3} />
            ) : overdueQuery.isError ? (
              <ErrorState onRetry={() => overdueQuery.refetch()} />
            ) : !overdueQuery.data || overdueQuery.data.items.length === 0 ? (
              <EmptyState
                title="Nothing overdue"
                description="Invoices that are overdue will show up here."
              />
            ) : (
              <InvoiceTable invoices={overdueQuery.data.items} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h3 className="text-base font-semibold">Recent activity</h3>
              <Link to="/activity" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            {activityQuery.isLoading ? (
              <LoadingState rows={4} />
            ) : activityQuery.isError ? (
              <ErrorState onRetry={() => activityQuery.refetch()} />
            ) : !activityQuery.data || activityQuery.data.items.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Reminders, payments and other events will show up here."
              />
            ) : (
              <ul className="space-y-3 rounded-xl border border-border bg-card p-4">
                {activityQuery.data.items.map((item) => {
                  const line = activityLine(item);
                  return (
                    <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium">{line.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
