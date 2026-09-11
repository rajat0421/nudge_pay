import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Send, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { getRecentActivity } from "@/features/dashboard/services/dashboard.service";
import type { ActivityItem } from "@/types/dashboard";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — NudgePay" },
      {
        name: "description",
        content: "Every reminder NudgePay has sent or attempted, in one timeline.",
      },
      { property: "og:title", content: "Activity — NudgePay" },
      { property: "og:description", content: "A full timeline of reminder activity." },
    ],
  }),
  component: ActivityPage,
});

const kindMeta: Record<"SENT" | "FAILED", { icon: LucideIcon; className: string }> = {
  SENT: { icon: Send, className: "bg-accent text-accent-foreground" },
  FAILED: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describe(item: ActivityItem) {
  const clientLabel = item.invoice.client?.name ?? "a client";
  if (item.status === "FAILED") {
    return {
      title: `Reminder failed — ${item.invoice.invoiceNumber}`,
      detail: item.lastError ?? `Delivery to ${clientLabel} failed`,
    };
  }
  return {
    title: `Reminder sent — ${item.invoice.invoiceNumber}`,
    detail: `Step ${item.reminderStep.stepOrder} delivered to ${clientLabel}`,
  };
}

function ActivityPage() {
  const [page, setPage] = useState(1);

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", { page, limit: PAGE_SIZE }],
    queryFn: () => getRecentActivity({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const data = activityQuery.data;

  return (
    <AppLayout title="Activity">
      <PageContainer>
        <PageHeading
          title="Activity"
          description="Every reminder NudgePay has sent or attempted, newest first."
        />

        {activityQuery.isLoading ? (
          <LoadingState rows={5} />
        ) : activityQuery.isError ? (
          <ErrorState onRetry={() => activityQuery.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Reminder activity will show up here once invoices with a reminder sequence go out."
          />
        ) : (
          <>
            <ol className="space-y-4 rounded-xl border border-border bg-card p-5">
              {data.items.map((item) => {
                const meta = kindMeta[item.status === "FAILED" ? "FAILED" : "SENT"];
                const Icon = meta.icon;
                const line = describe(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full",
                        meta.className,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/invoices/$invoiceId"
                        params={{ invoiceId: item.invoice.id }}
                        className="text-sm font-medium hover:underline"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>
                    </div>
                    <span className="nums shrink-0 text-xs text-muted-foreground">
                      {formatTimestamp(item.sentAt ?? item.updatedAt)}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span className="nums">
                Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)} ·{" "}
                {data.pagination.total} results
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}
