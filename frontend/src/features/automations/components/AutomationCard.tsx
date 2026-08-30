import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { useAutomationStore } from "@/store/automationStore";
import type { Automation, AutomationStep } from "@/types/automation";

export function AutomationCard({ automation }: { automation: Automation }) {
  const toggleActive = useAutomationStore((s) => s.toggleActive);
  const [editingStep, setEditingStep] = useState<AutomationStep | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{automation.name}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{automation.description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{automation.active ? "Active" : "Paused"}</span>
          <Switch
            checked={automation.active}
            onCheckedChange={() => toggleActive(automation.id)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 border-y border-border py-3 text-sm">
        <Stat label="Trigger" value={automation.trigger === "due_date" ? "Due date" : "Issue date"} />
        <Stat label="Invoices attached" value={String(automation.invoicesAttached)} />
        <Stat label="Recovered" value={formatCurrency(automation.recoveredAmount)} />
      </div>

      <ol className="mt-4 space-y-3">
        {automation.steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start justify-between gap-3 rounded-lg bg-secondary/60 p-3"
          >
            <div>
              <p className="text-sm font-medium">
                +{step.offsetDays} days · {step.subject}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{step.body}</p>
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

      <StepEditDialog
        automationId={automation.id}
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
  automationId,
  step,
  onClose,
}: {
  automationId: string;
  step: AutomationStep | null;
  onClose: () => void;
}) {
  const updateStep = useAutomationStore((s) => s.updateStep);

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
          onCancel={onClose}
          onSave={(patch) => {
            updateStep(automationId, step.id, patch);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

function StepEditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AutomationStep;
  onSave: (patch: Partial<AutomationStep>) => void;
  onCancel: () => void;
}) {
  const [offsetDays, setOffsetDays] = useState(initial.offsetDays);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit reminder step</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="offsetDays">Days after due date</Label>
          <Input
            id="offsetDays"
            type="number"
            value={offsetDays}
            onChange={(e) => setOffsetDays(Number(e.target.value))}
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
        <Button onClick={() => onSave({ offsetDays, subject, body })}>Save step</Button>
      </DialogFooter>
    </DialogContent>
  );
}
