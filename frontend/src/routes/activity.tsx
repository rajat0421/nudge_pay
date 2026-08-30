import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus,
  Send,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { activity, type ActivityItem } from "@/lib/mock-db";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Remindly" },
      {
        name: "description",
        content: "Every reminder sent, invoice marked paid and automation change, in one timeline.",
      },
      { property: "og:title", content: "Activity — Remindly" },
      { property: "og:description", content: "A full timeline of everything Remindly has done." },
    ],
  }),
  component: ActivityPage,
});

const kindMeta: Record<ActivityItem["kind"], { icon: LucideIcon; className: string }> = {
  reminder_sent: { icon: Send, className: "bg-accent text-accent-foreground" },
  reminder_failed: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  invoice_paid: { icon: CheckCircle2, className: "bg-success/10 text-success" },
  invoice_created: { icon: FilePlus, className: "bg-secondary text-secondary-foreground" },
  automation_changed: { icon: Workflow, className: "bg-secondary text-secondary-foreground" },
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActivityPage() {
  return (
    <AppLayout title="Activity">
      <PageContainer>
        <PageHeading
          title="Activity"
          description="Every reminder, payment and automation change, newest first."
        />

        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Things will show up here once invoices go out." />
        ) : (
          <ol className="space-y-4 rounded-xl border border-border bg-card p-5">
            {activity.map((item) => {
              const meta = kindMeta[item.kind];
              const Icon = meta.icon;
              return (
                <li key={item.id} className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", meta.className)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="nums shrink-0 text-xs text-muted-foreground">
                    {formatTimestamp(item.at)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </PageContainer>
    </AppLayout>
  );
}
