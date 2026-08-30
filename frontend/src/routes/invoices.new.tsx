import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants";
import { automations, customers } from "@/lib/mock-db";
import { useInvoiceStore } from "@/store/invoiceStore";

export const Route = createFileRoute("/invoices/new")({
  head: () => ({
    meta: [
      { title: "New invoice — Remindly" },
      {
        name: "description",
        content:
          "Add an invoice with its client, amount, due date and payment link, then attach a reminder sequence.",
      },
      { property: "og:title", content: "New invoice — Remindly" },
      {
        property: "og:description",
        content: "Create an invoice and attach an automated reminder sequence.",
      },
    ],
  }),
  component: NewInvoicePage,
});

const schema = z.object({
  customerId: z.string().min(1, "Pick a client"),
  number: z.string().min(3, "Invoice number is required"),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  currency: z.string().min(3),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  paymentUrl: z.string().url("Enter a valid payment URL").or(z.literal("")),
  automationId: z.string().min(1, "Pick a reminder sequence"),
});

type FormValues = z.input<typeof schema>;

function NewInvoicePage() {
  const navigate = useNavigate();
  const addInvoice = useInvoiceStore((s) => s.addInvoice);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: "",
      number: "",
      amount: 0,
      currency: "USD",
      issueDate: "",
      dueDate: "",
      paymentUrl: "",
      automationId: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.parse(values);
    const customer = customers.find((c) => c.id === parsed.customerId);
    addInvoice({
      id: `inv_${Math.random().toString(36).slice(2, 8)}`,
      number: parsed.number,
      customerId: parsed.customerId,
      customerName: customer?.name ?? "Unknown client",
      amount: parsed.amount,
      currency: parsed.currency,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      status: "sent",
      paymentUrl: parsed.paymentUrl,
      automationId: parsed.automationId,
      reminders: [],
    });
    toast.success(`${parsed.number} created — reminders scheduled`);
    navigate({ to: "/invoices" });
  });

  return (
    <AppLayout title="New invoice">
      <PageContainer className="max-w-3xl">
        <PageHeading
          title="New invoice"
          description="Remindly doesn't issue invoices — it tracks the ones you already sent and chases them."
        />

        <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={watch("customerId")}
                onValueChange={(v) => setValue("customerId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && (
                <p className="text-xs text-destructive">{errors.customerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="number">Invoice number</Label>
              <Input id="number" {...register("number")} />
              {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={watch("currency")}
                onValueChange={(v) => setValue("currency", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input id="issueDate" type="date" {...register("issueDate")} />
              {errors.issueDate && (
                <p className="text-xs text-destructive">{errors.issueDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" {...register("dueDate")} />
              {errors.dueDate && (
                <p className="text-xs text-destructive">{errors.dueDate.message}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="paymentUrl">Payment link</Label>
              <Input
                id="paymentUrl"
                placeholder="https://pay.stripe.com/…"
                {...register("paymentUrl")}
              />
              {errors.paymentUrl && (
                <p className="text-xs text-destructive">{errors.paymentUrl.message}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Reminder sequence</Label>
              <Select
                value={watch("automationId")}
                onValueChange={(v) => setValue("automationId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {automations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.steps.length} steps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/invoices" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create invoice
            </Button>
          </div>
        </form>
      </PageContainer>
    </AppLayout>
  );
}
