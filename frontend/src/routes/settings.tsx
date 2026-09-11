import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeading } from "@/components/layout/PageContainer";
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
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import {
  getMyOrganization,
  updateMyOrganization,
} from "@/features/settings/services/organization.service";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NudgePay" },
      {
        name: "description",
        content: "Manage your organization's name, timezone and currency.",
      },
      { property: "og:title", content: "Settings — NudgePay" },
      { property: "og:description", content: "Organization name, timezone and currency." },
    ],
  }),
  component: SettingsPage,
});

const schema = z.object({
  name: z.string().min(1, "Organization name is required"),
  timezone: z.string().min(1),
  currency: z.string().min(3),
});

type FormValues = z.input<typeof schema>;

function SettingsPage() {
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ["organization", "me"],
    queryFn: getMyOrganization,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    ...(orgQuery.data
      ? {
          values: {
            name: orgQuery.data.name,
            timezone: orgQuery.data.timezone,
            currency: orgQuery.data.currency,
          },
        }
      : {}),
  });

  const updateMutation = useMutation({
    mutationFn: updateMyOrganization,
    onSuccess: (org) => {
      queryClient.setQueryData(["organization", "me"], org);
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not save settings");
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.parse(values);
    updateMutation.mutate(parsed);
  });

  return (
    <AppLayout title="Settings">
      <PageContainer className="max-w-3xl">
        <PageHeading
          title="Settings"
          description="These organization details apply to reminder scheduling and currency formatting across NudgePay."
        />

        {orgQuery.isLoading ? (
          <LoadingState rows={2} />
        ) : orgQuery.isError ? (
          <ErrorState onRetry={() => orgQuery.refetch()} />
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-xl border border-border bg-card p-6"
          >
            <h3 className="text-base font-semibold">Organization</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Organization name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={watch("timezone")}
                  onValueChange={(v) => setValue("timezone", v, { shouldValidate: true })}
                >
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
            </div>

            <div className="flex justify-end border-t border-border pt-5">
              <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </AppLayout>
  );
}
