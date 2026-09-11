import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceTable } from "@/features/invoices/components/InvoiceTable";
import { listInvoices } from "@/features/invoices/services/invoice.service";
import { useDebounce } from "@/hooks/useDebounce";
import { PAGE_SIZE } from "@/lib/constants";
import type { InvoiceStatus } from "@/types/invoice";

export const Route = createFileRoute("/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices — NudgePay" },
      {
        name: "description",
        content:
          "Filter every invoice by status, search by client, and see how many reminders each one has triggered.",
      },
      { property: "og:title", content: "Invoices — NudgePay" },
      {
        property: "og:description",
        content: "Filter, search and track reminder progress on every invoice.",
      },
    ],
  }),
  component: InvoicesPage,
});

const tabs = ["all", "DRAFT", "SENT", "DUE", "OVERDUE", "PAID"] as const;
const tabLabels: Record<(typeof tabs)[number], string> = {
  all: "All",
  DRAFT: "Draft",
  SENT: "Sent",
  DUE: "Due soon",
  OVERDUE: "Overdue",
  PAID: "Paid",
};

function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(query);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", { status, search: debounced, page }],
    queryFn: () =>
      listInvoices({
        page,
        limit: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        search: debounced || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const data = invoicesQuery.data;

  return (
    <AppLayout title="Invoices">
      <PageContainer>
        <PageHeading
          title="Invoices"
          description={
            data ? `${data.pagination.total} invoices tracked · reminders run automatically after the due date.` : undefined
          }
          actions={
            <Button asChild>
              <Link to="/invoices/new">
                <Plus className="size-4" />
                New invoice
              </Link>
            </Button>
          }
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus(v as InvoiceStatus | "all");
              setPage(1);
            }}
          >
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {tabLabels[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search number or client"
              className="w-full pl-8 sm:w-64"
            />
          </div>
        </div>

        {invoicesQuery.isLoading ? (
          <LoadingState rows={PAGE_SIZE} />
        ) : invoicesQuery.isError ? (
          <ErrorState onRetry={() => invoicesQuery.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No invoices match"
            description="Try a different status filter or clear your search."
          />
        ) : (
          <>
            <InvoiceTable invoices={data.items} />
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
