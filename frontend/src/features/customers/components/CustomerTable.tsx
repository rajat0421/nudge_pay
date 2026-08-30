import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/types/customer";

export function CustomerTable({ customers }: { customers: Customer[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="text-right">Avg. days to pay</TableHead>
            <TableHead className="text-right">Invoices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell className="text-muted-foreground">
                <span className="block">{customer.contactName}</span>
                <span className="block text-xs">{customer.email}</span>
              </TableCell>
              <TableCell className="nums text-right font-medium">
                {customer.outstanding > 0 ? formatCurrency(customer.outstanding) : "—"}
              </TableCell>
              <TableCell className="nums text-right text-muted-foreground">
                {customer.avgDaysToPay}d
              </TableCell>
              <TableCell className="nums text-right text-muted-foreground">
                {customer.invoiceCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
