import { useState, type ReactNode } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { createSequence } from "@/features/automations/services/reminder-sequence.service";

const stepSchema = z.object({
  delayDays: z.coerce.number().int().min(0, "Must be 0 or more"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  steps: z.array(stepSchema).min(1, "Add at least one step"),
});

type FormValues = z.input<typeof schema>;

export function SequenceFormDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      steps: [{ delayDays: 3, subject: "", body: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "steps" });

  const createMutation = useMutation({
    mutationFn: createSequence,
    onSuccess: (sequence) => {
      void queryClient.invalidateQueries({ queryKey: ["reminder-sequences"] });
      toast.success(`${sequence.name} created`);
      reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create sequence");
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.parse(values);
    createMutation.mutate({
      name: parsed.name,
      description: parsed.description || undefined,
      steps: parsed.steps,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create reminder sequence</DialogTitle>
          <DialogDescription>
            Define a name and one or more reminder steps, each sent a number of days after the
            invoice's due date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Steps</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ delayDays: 7, subject: "", body: "" })}
              >
                <Plus className="size-4" />
                Add step
              </Button>
            </div>
            {errors.steps?.root && (
              <p className="text-xs text-destructive">{errors.steps.root.message}</p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor={`steps.${index}.delayDays`}>Days after due date</Label>
                    <Input
                      id={`steps.${index}.delayDays`}
                      type="number"
                      {...register(`steps.${index}.delayDays`)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 shrink-0"
                      aria-label="Remove step"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`steps.${index}.subject`}>Subject</Label>
                  <Input id={`steps.${index}.subject`} {...register(`steps.${index}.subject`)} />
                  {errors.steps?.[index]?.subject && (
                    <p className="text-xs text-destructive">
                      {errors.steps[index]?.subject?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`steps.${index}.body`}>Body</Label>
                  <Textarea
                    id={`steps.${index}.body`}
                    rows={4}
                    className="font-mono text-sm"
                    {...register(`steps.${index}.body`)}
                  />
                  {errors.steps?.[index]?.body && (
                    <p className="text-xs text-destructive">
                      {errors.steps[index]?.body?.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              Create sequence
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
