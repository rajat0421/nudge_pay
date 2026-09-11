import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
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
import { ApiError } from "@/lib/api";
import { listClients } from "@/features/customers/services/client.service";
import { listSequences } from "@/features/automations/services/reminder-sequence.service";
import { createInvoice } from "@/features/invoices/services/invoice.service";

export const Route = createFileRoute("/invoices/new")({
  head: () => ({
    meta: [
      { title: "New invoice — NudgePay" },
      {
        name: "description",
        content:
          "Add an invoice with its client, amount, due date and payment link, then attach a reminder sequence.",
      },
      { property: "og:title", content: "New invoice — NudgePay" },
      {
        property: "og:description",
        content: "Create an invoice and attach an automated reminder sequence.",
      },
    ],
  }),
  component: NewInvoicePage,
});

const NO_SEQUENCE = "__none__";

const schema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  currency: z.string().min(3),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  paymentUrl: z.string().url("Enter a valid payment URL").or(z.literal("")),
  reminderSequenceId: z.string(),
});

type FormValues = z.input<typeof schema>;

function NewInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ["clients", { limit: 100 }],
    queryFn: () => listClients({ limit: 100 }),
  });
  const sequencesQuery = useQuery({
    queryKey: ["reminder-sequences"],
    queryFn: listSequences,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: "",
      invoiceNumber: "",
      amount: 0,
      currency: "USD",
      issueDate: "",
      dueDate: "",
      paymentUrl: "",
      reminderSequenceId: NO_SEQUENCE,
    },
  });

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${invoice.invoiceNumber} created — reminders scheduled`);
      navigate({ to: "/invoices" });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create invoice");
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.parse(values);
    createMutation.mutate({
      clientId: parsed.clientId,
      invoiceNumber: parsed.invoiceNumber,
      amount: parsed.amount,
      currency: parsed.currency,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      paymentUrl: parsed.paymentUrl || undefined,
      reminderSequenceId:
        parsed.reminderSequenceId === NO_SEQUENCE ? undefined : parsed.reminderSequenceId,
    });
  });

  const clients = clientsQuery.data?.items ?? [];
  const sequences = sequencesQuery.data ?? [];
  const noClients = clientsQuery.isSuccess && clients.length === 0;

  return (
    <AppLayout title="New invoice">
      <PageContainer className="max-w-3xl">
        <PageHeading
          title="New invoice"
          description="NudgePay doesn't issue invoices — it tracks the ones you already sent and chases them."
        />

        {clientsQuery.isLoading || sequencesQuery.isLoading ? (
          <LoadingState rows={4} />
        ) : clientsQuery.isError ? (
          <ErrorState onRetry={() => clientsQuery.refetch()} />
        ) : sequencesQuery.isError ? (
          <ErrorState onRetry={() => sequencesQuery.refetch()} />
        ) : noClients ? (
          <EmptyState
            title="Add a client first"
            description="You need at least one client before you can create an invoice."
            action={
              <Button asChild variant="outline">
                <Link to="/customers">Add a client</Link>
              </Button>
            }
          />
        ) : (
          <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={watch("clientId")}
                  onValueChange={(v) => setValue("clientId", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.clientId && (
                  <p className="text-xs text-destructive">{errors.clientId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice number</Label>
                <Input id="invoiceNumber" {...register("invoiceNumber")} />
                {errors.invoiceNumber && (
                  <p className="text-xs text-destructive">{errors.invoiceNumber.message}</p>
                )}
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
                  value={watch("reminderSequenceId")}
                  onValueChange={(v) => setValue("reminderSequenceId", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEQUENCE}>None</SelectItem>
                    {sequences.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.steps.length} steps
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
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                Create invoice
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </AppLayout>
  );
}
