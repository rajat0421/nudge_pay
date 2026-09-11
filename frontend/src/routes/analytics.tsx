import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileText, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { getDashboardSummary } from "@/features/dashboard/services/dashboard.service";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — NudgePay" },
      {
        name: "description",
        content: "Outstanding, overdue and collected totals across every invoice.",
      },
      { property: "og:title", content: "Analytics — NudgePay" },
      { property: "og:description", content: "Outstanding, overdue and collected totals." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
  });

  return (
    <AppLayout title="Analytics">
      <PageContainer>
        <PageHeading
          title="Analytics"
          description="Outstanding, overdue and collected totals across every invoice."
        />

        {summaryQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : summaryQuery.isError ? (
          <ErrorState onRetry={() => summaryQuery.refetch()} />
        ) : summaryQuery.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Outstanding"
              value={formatCurrency(summaryQuery.data.outstandingAmount)}
              icon={Wallet}
            />
            <KpiCard
              label="Overdue"
              value={formatCurrency(summaryQuery.data.overdueAmount)}
              delta={`${summaryQuery.data.overdueCount} invoices past due`}
              tone={summaryQuery.data.overdueCount > 0 ? "negative" : "neutral"}
              icon={AlertCircle}
            />
            <KpiCard
              label="Paid this month"
              value={formatCurrency(summaryQuery.data.paidThisMonth)}
              tone="positive"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Total invoices"
              value={String(summaryQuery.data.totalInvoices)}
              icon={FileText}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <EmptyState
            title="Trend charts coming soon"
            description="Historical collection trends and reminder-recovery totals aren't available from the backend yet — this page shows only real, current totals."
          />
        </div>
      </PageContainer>
    </AppLayout>
  );
}
