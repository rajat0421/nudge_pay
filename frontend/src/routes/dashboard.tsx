import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowUpRight, CheckCircle2, Send, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { InvoiceTable } from "@/features/invoices/components/InvoiceTable";
import { summarize } from "@/features/invoices/services/invoice.service";
import { activity } from "@/lib/mock-db";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";
import { useInvoiceStore } from "@/store/invoiceStore";

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

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const invoices = useInvoiceStore((s) => s.invoices);
  const stats = summarize(invoices);
  const attention = invoices.filter((i) => i.status === "overdue" || i.status === "sent").slice(0, 5);

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Outstanding"
            value={formatCurrency(stats.outstanding)}
            delta={`Across ${stats.outstandingCount} open invoice${stats.outstandingCount === 1 ? "" : "s"}`}
            icon={Wallet}
          />
          <KpiCard
            label="Overdue"
            value={formatCurrency(stats.overdue)}
            delta={`${stats.overdueCount} invoices past due`}
            tone="negative"
            icon={AlertCircle}
          />
          <KpiCard
            label="Paid this month"
            value={formatCurrency(stats.paid)}
            tone="positive"
            icon={CheckCircle2}
          />
          <KpiCard
            label="Reminders sent"
            value={String(stats.remindersSent)}
            delta={`${stats.remindersFailed} failed`}
            tone={stats.remindersFailed > 0 ? "negative" : "neutral"}
            icon={Send}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-end justify-between">
              <h3 className="text-base font-semibold">Needs attention</h3>
              <Link to="/invoices" className="text-sm text-primary hover:underline">
                All invoices
              </Link>
            </div>
            {attention.length === 0 ? (
              <EmptyState
                title="Nothing needs attention"
                description="Invoices that are sent or overdue will show up here."
              />
            ) : (
              <InvoiceTable invoices={attention} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h3 className="text-base font-semibold">Recent activity</h3>
              <Link to="/activity" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Reminders, payments and other events will show up here."
              />
            ) : (
              <ul className="space-y-3 rounded-xl border border-border bg-card p-4">
                {activity.slice(0, 4).map((item) => (
                  <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
