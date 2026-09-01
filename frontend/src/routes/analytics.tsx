import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Clock, TrendingUp, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatCurrency } from "@/lib/format";
import { automations, customers, monthlyStats } from "@/lib/mock-db";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — NudgePay" },
      {
        name: "description",
        content: "Outstanding vs. collected trends and how much automated reminders have recovered.",
      },
      { property: "og:title", content: "Analytics — NudgePay" },
      { property: "og:description", content: "Collections trend and reminder recovery totals." },
    ],
  }),
  component: AnalyticsPage,
});

const chartConfig = {
  outstanding: { label: "Outstanding", color: "var(--chart-4)" },
  collected: { label: "Collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

function AnalyticsPage() {
  const recovered = automations.reduce((sum, a) => sum + a.recoveredAmount, 0);
  const avgDaysToPay =
    customers.length === 0
      ? 0
      : Math.round(customers.reduce((sum, c) => sum + c.avgDaysToPay, 0) / customers.length);
  const collectedThisMonth = monthlyStats.at(-1)?.collected ?? 0;

  return (
    <AppLayout title="Analytics">
      <PageContainer>
        <PageHeading
          title="Analytics"
          description="How collections are trending and what automated reminders have recovered."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Recovered by automations"
            value={formatCurrency(recovered)}
            delta="Since automations were turned on"
            tone="positive"
            icon={TrendingUp}
          />
          <KpiCard
            label="Collected this month"
            value={formatCurrency(collectedThisMonth)}
            delta={`Across ${monthlyStats.length} months tracked`}
            icon={Wallet}
          />
          <KpiCard
            label="Avg. days to pay"
            value={`${avgDaysToPay}d`}
            delta="Averaged across all clients"
            icon={Clock}
          />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-base font-semibold">Outstanding vs. collected</h3>
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <BarChart data={monthlyStats}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="outstanding" fill="var(--color-outstanding)" radius={4} />
              <Bar dataKey="collected" fill="var(--color-collected)" radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
