import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { TIMEZONES } from "@/lib/constants";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NudgePay" },
      {
        name: "description",
        content: "Manage your organization, sender identity for reminder emails, and plan.",
      },
      { property: "og:title", content: "Settings — NudgePay" },
      { property: "og:description", content: "Organization, sender identity and plan settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [organization, setOrganization] = useState(user?.organization ?? "");
  const [senderName, setSenderName] = useState(user?.senderName ?? "");
  const [senderEmail, setSenderEmail] = useState(user?.senderEmail ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");

  const savedIdentity = () => {
    updateUser({ organization, senderName, senderEmail, timezone });
    toast.success("Settings saved");
  };

  return (
    <AppLayout title="Settings">
      <PageContainer className="max-w-3xl">
        <PageHeading
          title="Settings"
          description="Reminder emails send from this identity — clients see it in their inbox, not NudgePay."
        />

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">Organization</h3>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization name</Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
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
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">Sender identity</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Used as the "From" name and address on every automated reminder.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender name</Label>
                <Input
                  id="senderName"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender email</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end border-t border-border pt-5">
              <Button onClick={savedIdentity}>Save changes</Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Plan</h3>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {user?.plan ?? "trialing"} · unlimited reminders while validating with pilot clients
                </p>
              </div>
              <Button variant="outline" disabled>
                Manage billing
              </Button>
            </div>
          </section>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
