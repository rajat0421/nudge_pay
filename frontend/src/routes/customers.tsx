import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { CustomerTable } from "@/features/customers/components/CustomerTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useCustomerStore } from "@/store/customerStore";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Clients — Remindly" },
      {
        name: "description",
        content: "Every client you invoice, how much they owe and how fast they typically pay.",
      },
      { property: "og:title", content: "Clients — Remindly" },
      {
        property: "og:description",
        content: "Outstanding balances and payment speed for every client.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useCustomerStore((s) => s.customers);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query);

  const q = debounced.trim().toLowerCase();
  const filtered = customers.filter(
    (c) => q.length === 0 || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
  );

  return (
    <AppLayout title="Clients">
      <PageContainer>
        <PageHeading
          title="Clients"
          description={`${customers.length} clients on file · outstanding balances update as invoices are paid.`}
        />

        <div className="mb-4 flex justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full pl-8 sm:w-64"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No clients match" description="Try a different search." />
        ) : (
          <CustomerTable customers={filtered} />
        )}
      </PageContainer>
    </AppLayout>
  );
}
