import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceTable } from "@/features/invoices/components/InvoiceTable";
import { filterInvoices } from "@/features/invoices/services/invoice.service";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PAGE_SIZE } from "@/lib/constants";
import { useInvoiceStore } from "@/store/invoiceStore";
import type { InvoiceStatus } from "@/types/invoice";

export const Route = createFileRoute("/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices — Remindly" },
      {
        name: "description",
        content:
          "Filter every invoice by status, search by client, and see how many reminders each one has triggered.",
      },
      { property: "og:title", content: "Invoices — Remindly" },
      {
        property: "og:description",
        content: "Filter, search and track reminder progress on every invoice.",
      },
    ],
  }),
  component: InvoicesPage,
});

const tabs = ["all", "overdue", "sent", "paid", "draft"] as const;

function InvoicesPage() {
  const invoices = useInvoiceStore((s) => s.invoices);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query);

  const filtered = filterInvoices(invoices, { status, query: debounced });
  const { pageItems, page, pageCount, next, prev } = usePagination(filtered, PAGE_SIZE);

  return (
    <AppLayout title="Invoices">
      <PageContainer>
        <PageHeading
          title="Invoices"
          description={`${invoices.length} invoices tracked · reminders run automatically after the due date.`}
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
          <Tabs value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | "all")}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number or client"
              className="w-full pl-8 sm:w-64"
            />
          </div>
        </div>

        {pageItems.length === 0 ? (
          <EmptyState
            title="No invoices match"
            description="Try a different status filter or clear your search."
          />
        ) : (
          <>
            <InvoiceTable invoices={pageItems} />
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span className="nums">
                Page {page} of {pageCount} · {filtered.length} results
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={prev} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={next} disabled={page === pageCount}>
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
