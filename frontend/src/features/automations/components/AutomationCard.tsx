import { useState } from "react";
import { Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  updateSequence,
  updateSequenceStep,
} from "@/features/automations/services/reminder-sequence.service";
import type { ReminderSequence, ReminderStep } from "@/types/automation";

export function AutomationCard({ automation }: { automation: ReminderSequence }) {
  const queryClient = useQueryClient();
  const [editingStep, setEditingStep] = useState<ReminderStep | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => updateSequence(automation.id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reminder-sequences"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update sequence");
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{automation.name}</h3>
          {automation.description && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {automation.description}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {automation.isActive ? "Active" : "Paused"}
          </span>
          <Switch
            checked={automation.isActive}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 border-y border-border py-3 text-sm">
        <Stat label="Steps" value={String(automation.steps.length)} />
      </div>

      {automation.steps.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No steps configured yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {automation.steps
            .slice()
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step) => (
              <li
                key={step.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-secondary/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    +{step.delayDays} days · {step.emailTemplate.subject}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {step.emailTemplate.body}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Edit step"
                  onClick={() => setEditingStep(step)}
                >
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
        </ol>
      )}

      <StepEditDialog
        sequenceId={automation.id}
        step={editingStep}
        onClose={() => setEditingStep(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="nums mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function StepEditDialog({
  sequenceId,
  step,
  onClose,
}: {
  sequenceId: string;
  step: ReminderStep | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (input: { delayDays: number; subject: string; body: string }) =>
      updateSequenceStep(sequenceId, step!.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reminder-sequences"] });
      toast.success("Step updated");
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update step");
    },
  });

  return (
    <Dialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {step && (
        <StepEditForm
          key={step.id}
          initial={step}
          isSaving={updateMutation.isPending}
          onCancel={onClose}
          onSave={(patch) => updateMutation.mutate(patch)}
        />
      )}
    </Dialog>
  );
}

function StepEditForm({
  initial,
  isSaving,
  onSave,
  onCancel,
}: {
  initial: ReminderStep;
  isSaving: boolean;
  onSave: (patch: { delayDays: number; subject: string; body: string }) => void;
  onCancel: () => void;
}) {
  const [delayDays, setDelayDays] = useState(initial.delayDays);
  const [subject, setSubject] = useState(initial.emailTemplate.subject);
  const [body, setBody] = useState(initial.emailTemplate.body);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit reminder step</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="delayDays">Days after due date</Label>
          <Input
            id="delayDays"
            type="number"
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave({ delayDays, subject, body })} disabled={isSaving}>
          Save step
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
