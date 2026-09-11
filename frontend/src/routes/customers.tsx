import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerTable } from "@/features/customers/components/CustomerTable";
import { ClientFormDialog } from "@/features/customers/components/ClientFormDialog";
import { listClients } from "@/features/customers/services/client.service";
import { useDebounce } from "@/hooks/useDebounce";
import { PAGE_SIZE } from "@/lib/constants";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Clients — NudgePay" },
      {
        name: "description",
        content: "Every client you invoice, with their contact details on file.",
      },
      { property: "og:title", content: "Clients — NudgePay" },
      {
        property: "og:description",
        content: "Manage the clients you send invoices and reminders to.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(query);

  const clientsQuery = useQuery({
    queryKey: ["clients", { search: debounced, page }],
    queryFn: () => listClients({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    placeholderData: keepPreviousData,
  });

  const data = clientsQuery.data;
  const addClientButton = (
    <ClientFormDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Add client
        </Button>
      }
    />
  );

  return (
    <AppLayout title="Clients">
      <PageContainer>
        <PageHeading
          title="Clients"
          description={data ? `${data.pagination.total} clients on file.` : undefined}
          actions={addClientButton}
        />

        <div className="mb-4 flex justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              className="w-full pl-8 sm:w-64"
            />
          </div>
        </div>

        {clientsQuery.isLoading ? (
          <LoadingState rows={PAGE_SIZE} />
        ) : clientsQuery.isError ? (
          <ErrorState onRetry={() => clientsQuery.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={debounced ? "No clients match" : "No clients yet"}
            description={
              debounced
                ? "Try a different search."
                : "Add your first client to start sending invoices."
            }
            action={debounced ? undefined : addClientButton}
          />
        ) : (
          <>
            <CustomerTable customers={data.items} />
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
