import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { APP_NAME, CURRENCIES, TIMEZONES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { buildCustomSteps, REMINDER_PRESETS } from "@/features/onboarding/reminder-presets";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: `Set up your account — ${APP_NAME}` }],
  }),
  component: OnboardingPage,
});

const STEPS = ["Business", "First client", "First invoice", "Reminders"] as const;

interface ClientDraft {
  id: string;
  name: string;
  email: string;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 — business
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");

  // Step 2 — first client
  const [client, setClient] = useState<ClientDraft | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Step 3 — first invoice (held locally; only submitted once a sequence is chosen)
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");

  // Step 4 — reminders
  const [presetKey, setPresetKey] = useState<"friendly" | "aggressive" | "custom">("friendly");
  const [customDelays, setCustomDelays] = useState<[number, number, number]>([2, 7, 14]);

  useEffect(() => {
    if (isHydrated && !user) {
      navigate({ to: "/login" });
    }
  }, [isHydrated, user, navigate]);

  if (!isHydrated || !user) return null;

  const skip = () => navigate({ to: "/dashboard" });

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.patch("/organizations/me", { timezone, currency });
      updateUser({ timezone });
      setStep(1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save that — try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.post<{ id: string; name: string; email: string }>("/clients", {
        name: clientName,
        companyName: clientCompany || undefined,
        email: clientEmail,
      });
      setClient({ id: created.id, name: created.name, email: created.email });
      setStep(2);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save that client — try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceNumber || !amount || !dueDate) {
      toast.error("Fill in invoice number, amount and due date");
      return;
    }
    setStep(3);
  }

  async function handleFinish() {
    if (!client) return;
    setIsSubmitting(true);
    try {
      const steps =
        presetKey === "custom"
          ? buildCustomSteps(customDelays)
          : REMINDER_PRESETS.find((p) => p.key === presetKey)!.steps;

      const sequence = await api.post<{ id: string }>("/reminder-sequences", {
        name: presetKey === "custom" ? "Custom sequence" : `${presetKey === "friendly" ? "Friendly" : "Aggressive"} 3-step chase`,
        steps,
      });

      const today = new Date().toISOString().slice(0, 10);
      await api.post("/invoices", {
        clientId: client.id,
        invoiceNumber,
        amount: Number(amount),
        currency,
        issueDate: today,
        dueDate,
        paymentUrl: paymentUrl || undefined,
        reminderSequenceId: sequence.id,
      });

      toast.success("You're all set — NudgePay will handle the follow-ups automatically.");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong — try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">Let's get your account set up.</p>
          </div>
          <button
            onClick={skip}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </div>

        <ol className="mb-8 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : index === step
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                )}
              >
                {index < step ? <Check className="size-3.5" /> : index + 1}
              </span>
              {index < STEPS.length - 1 && (
                <span className={cn("h-px flex-1", index < step ? "bg-primary" : "bg-border")} />
              )}
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-border bg-card p-6">
          {step === 0 && (
            <form onSubmit={handleBusinessSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Tell us about your business</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This decides what timezone reminders send in.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Continue
              </Button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Add your first client</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Whoever you're chasing an invoice with right now.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">Contact name</Label>
                <Input id="clientName" required value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientCompany">Company (optional)</Label>
                <Input id="clientCompany" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Billing email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  Continue
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Add your first invoice</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  For {client?.name ?? "your client"} — NudgePay tracks it, it doesn't issue it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice number</Label>
                <Input
                  id="invoiceNumber"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-1001"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentUrl">Payment link (optional)</Label>
                <Input
                  id="paymentUrl"
                  placeholder="https://pay.stripe.com/…"
                  value={paymentUrl}
                  onChange={(e) => setPaymentUrl(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Continue
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Choose your reminder sequence</h2>
                <p className="mt-1 text-sm text-muted-foreground">How should NudgePay follow up?</p>
              </div>

              <RadioGroup value={presetKey} onValueChange={(v) => setPresetKey(v as typeof presetKey)}>
                {REMINDER_PRESETS.map((preset) => (
                  <label
                    key={preset.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                      presetKey === preset.key ? "border-primary bg-accent/40" : "border-border",
                    )}
                  >
                    <RadioGroupItem value={preset.key} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </div>
                  </label>
                ))}
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                    presetKey === "custom" ? "border-primary bg-accent/40" : "border-border",
                  )}
                >
                  <RadioGroupItem value="custom" className="mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Custom</p>
                    <p className="text-xs text-muted-foreground">Set your own three delays (days after due date).</p>
                    {presetKey === "custom" && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {customDelays.map((delay, index) => (
                          <Input
                            key={index}
                            type="number"
                            min={0}
                            value={delay}
                            onChange={(e) => {
                              const next = [...customDelays] as [number, number, number];
                              next[index] = Number(e.target.value);
                              setCustomDelays(next);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </RadioGroup>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" className="flex-1" onClick={handleFinish} disabled={isSubmitting}>
                  {isSubmitting ? "Setting up…" : "Activate"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
