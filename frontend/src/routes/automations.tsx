import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { AutomationCard } from "@/features/automations/components/AutomationCard";
import { SequenceFormDialog } from "@/features/automations/components/SequenceFormDialog";
import { listSequences } from "@/features/automations/services/reminder-sequence.service";

export const Route = createFileRoute("/automations")({
  head: () => ({
    meta: [
      { title: "Automations — NudgePay" },
      {
        name: "description",
        content:
          "Reminder sequences that chase overdue invoices automatically — edit steps or pause them per client type.",
      },
      { property: "og:title", content: "Automations — NudgePay" },
      {
        property: "og:description",
        content: "Every automated reminder sequence and its steps.",
      },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const sequencesQuery = useQuery({
    queryKey: ["reminder-sequences"],
    queryFn: listSequences,
  });

  const createButton = (
    <SequenceFormDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          New sequence
        </Button>
      }
    />
  );

  return (
    <AppLayout title="Automations">
      <PageContainer>
        <PageHeading
          title="Automations"
          description="Reminder sequences run automatically once an invoice is attached — no manual follow-up needed."
          actions={createButton}
        />

        {sequencesQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : sequencesQuery.isError ? (
          <ErrorState onRetry={() => sequencesQuery.refetch()} />
        ) : !sequencesQuery.data || sequencesQuery.data.length === 0 ? (
          <EmptyState
            title="No automations yet"
            description="Create a reminder sequence to start chasing overdue invoices automatically."
            action={createButton}
          />
        ) : (
          <div className="space-y-4">
            {sequencesQuery.data.map((automation) => (
              <AutomationCard key={automation.id} automation={automation} />
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
