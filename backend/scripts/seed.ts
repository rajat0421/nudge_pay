/* eslint-disable no-console */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/modules/email/templates";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run the seed script`);
  return value;
}

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

// The Supabase client has no generated Database type, so every query's row
// type is `any` — always pass an explicit type argument (`unwrap<Row>(...)`)
// rather than a bare `unwrap(...)`, which infers incorrectly against `any`.
interface SeedRow {
  id: string;
  name: string;
  invoiceNumber: string;
  [key: string]: unknown;
}

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

async function main() {
  console.log("Seeding NudgePay development data...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const organization = unwrap<SeedRow>(
    await supabase
      .from("organizations")
      .upsert(
        { id: SEED_ORG_ID, name: "Acme Digital Agency", timezone: "America/New_York", currency: "USD" },
        { onConflict: "id" },
      )
      .select()
      .single(),
  );

  const owner = unwrap<SeedRow>(
    await supabase
      .from("users")
      .upsert(
        { email: "owner@example.com", passwordHash, firstName: "Jamie", lastName: "Rivera" },
        { onConflict: "email" },
      )
      .select()
      .single(),
  );

  await supabase
    .from("organization_members")
    .upsert(
      { organizationId: organization.id, userId: owner.id, role: "OWNER" },
      { onConflict: "organizationId,userId" },
    );

  // Idempotency: wipe this seed organization's dependent data (in FK-safe
  // order) before recreating it fresh, so re-running the seed against the
  // same Supabase database never hits a unique-constraint conflict and
  // always leaves the same, predictable end state.
  await supabase.from("reminder_events").delete().eq("organizationId", organization.id);
  const { data: sequenceIds } = await supabase
    .from("reminder_sequences")
    .select("id")
    .eq("organizationId", organization.id);
  if (sequenceIds && sequenceIds.length > 0) {
    await supabase
      .from("reminder_steps")
      .delete()
      .in("reminderSequenceId", sequenceIds.map((s) => s.id));
  }
  await supabase.from("email_templates").delete().eq("organizationId", organization.id);
  await supabase.from("reminder_sequences").delete().eq("organizationId", organization.id);
  await supabase.from("invoices").delete().eq("organizationId", organization.id);
  await supabase.from("clients").delete().eq("organizationId", organization.id);

  const clientRows = unwrap<SeedRow[]>(
    await supabase
      .from("clients")
      .insert([
        {
          organizationId: organization.id,
          name: "Dana Whitfield",
          companyName: "Bluebird Marketing",
          email: "ap@bluebirdmarketing.example.com",
        },
        {
          organizationId: organization.id,
          name: "Marcus Bell",
          companyName: "Fenwick & Holt",
          email: "finance@fenwickholt.example.com",
        },
        {
          organizationId: organization.id,
          name: "Priya Nair",
          companyName: "Northstar Studio",
          email: "accounts@northstarstudio.example.com",
        },
        {
          organizationId: organization.id,
          name: "Tobias Krause",
          companyName: "Harborline Logistics",
          email: "billing@harborline.example.com",
        },
        {
          organizationId: organization.id,
          name: "Elise Moreau",
          companyName: "Moreau Consulting",
          email: "elise@moreauconsulting.example.com",
        },
      ])
      .select(),
  );
  const clientPaid = clientRows[0]!;
  const clientDueSoon = clientRows[1]!;
  const clientOverdue = clientRows[2]!;
  const clientOverdueReminders = clientRows[3]!;
  const clientDraft = clientRows[4]!;

  // Reminder sequence: +2 / +7 / +14 days, using the default professional templates.
  const sequence = unwrap<SeedRow>(
    await supabase
      .from("reminder_sequences")
      .insert({
        organizationId: organization.id,
        name: "Standard 3-step chase",
        description: "Friendly nudge, follow-up, then a final reminder.",
        isActive: true,
      })
      .select()
      .single(),
  );

  const steps = [];
  for (const [index, template] of DEFAULT_TEMPLATES.entries()) {
    const emailTemplate = unwrap<SeedRow>(
      await supabase
        .from("email_templates")
        .insert({
          organizationId: organization.id,
          name: template.name,
          subject: template.subject,
          body: template.body,
        })
        .select()
        .single(),
    );
    const step = unwrap<SeedRow>(
      await supabase
        .from("reminder_steps")
        .insert({
          reminderSequenceId: sequence.id,
          stepOrder: index + 1,
          delayDays: template.delayDays,
          emailTemplateId: emailTemplate.id,
        })
        .select()
        .single(),
    );
    steps.push(step);
  }

  const invoiceRows = unwrap<SeedRow[]>(
    await supabase
      .from("invoices")
      .insert([
        {
          organizationId: organization.id,
          clientId: clientPaid.id,
          invoiceNumber: "INV-1001",
          amount: 154000,
          currency: "USD",
          issueDate: daysFromNow(-45),
          dueDate: daysFromNow(-15),
          paymentUrl: "https://pay.example.com/inv-1001",
          reminderSequenceId: sequence.id,
          status: "PAID",
          paidAt: daysFromNow(-10),
        },
        {
          organizationId: organization.id,
          clientId: clientDueSoon.id,
          invoiceNumber: "INV-1002",
          amount: 96000,
          currency: "USD",
          issueDate: daysFromNow(-14),
          dueDate: daysFromNow(2),
          paymentUrl: "https://pay.example.com/inv-1002",
          reminderSequenceId: sequence.id,
          status: "DUE",
        },
        {
          organizationId: organization.id,
          clientId: clientOverdue.id,
          invoiceNumber: "INV-1003",
          amount: 72000,
          currency: "USD",
          issueDate: daysFromNow(-20),
          dueDate: daysFromNow(-1),
          paymentUrl: "https://pay.example.com/inv-1003",
          reminderSequenceId: sequence.id,
          status: "OVERDUE",
        },
        {
          organizationId: organization.id,
          clientId: clientOverdueReminders.id,
          invoiceNumber: "INV-1004",
          amount: 43000,
          currency: "EUR",
          issueDate: daysFromNow(-40),
          dueDate: daysFromNow(-16),
          paymentUrl: "https://pay.example.com/inv-1004",
          reminderSequenceId: sequence.id,
          status: "OVERDUE",
        },
        {
          organizationId: organization.id,
          clientId: clientDraft.id,
          invoiceNumber: "INV-1005",
          amount: 71000,
          currency: "USD",
          issueDate: daysFromNow(-1),
          dueDate: daysFromNow(29),
          paymentUrl: "",
          status: "DRAFT",
        },
      ])
      .select(),
  );
  const invoicePaid = invoiceRows[0]!;
  const invoiceDueSoon = invoiceRows[1]!;
  const invoiceOverdue = invoiceRows[2]!;
  const invoiceOverdueWithReminders = invoiceRows[3]!;

  const step1 = steps[0]!;
  const step2 = steps[1]!;
  const step3 = steps[2]!;

  // Seed scheduled/sent reminder events for the invoices above without
  // triggering the live worker to actually email these fake addresses.
  await supabase.from("reminder_events").insert([
    {
      organizationId: organization.id,
      invoiceId: invoiceDueSoon.id,
      reminderStepId: step1.id,
      scheduledAt: daysFromNow(4),
      status: "PENDING",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceDueSoon.id,
      reminderStepId: step2.id,
      scheduledAt: daysFromNow(9),
      status: "PENDING",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceOverdue.id,
      reminderStepId: step1.id,
      scheduledAt: daysFromNow(1),
      sentAt: daysFromNow(1),
      status: "SENT",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceOverdue.id,
      reminderStepId: step2.id,
      scheduledAt: daysFromNow(6),
      status: "PENDING",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceOverdueWithReminders.id,
      reminderStepId: step1.id,
      scheduledAt: daysFromNow(-14),
      sentAt: daysFromNow(-14),
      status: "SENT",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceOverdueWithReminders.id,
      reminderStepId: step2.id,
      scheduledAt: daysFromNow(-9),
      sentAt: daysFromNow(-9),
      status: "SENT",
    },
    {
      organizationId: organization.id,
      invoiceId: invoiceOverdueWithReminders.id,
      reminderStepId: step3.id,
      scheduledAt: daysFromNow(-2),
      status: "FAILED",
      attempts: 4,
      lastError: "Mailbox full (simulated seed data)",
    },
  ]);

  await supabase.from("audit_logs").insert({
    organizationId: organization.id,
    userId: owner.id,
    action: "seed.completed",
    entityType: "Organization",
    entityId: organization.id,
    metadata: { invoices: 5, clients: 5 },
  });

  console.log("Seed complete.");
  console.log("  Login: owner@example.com / password123");
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(
    `  Invoices: ${invoicePaid.invoiceNumber} (paid), ${invoiceDueSoon.invoiceNumber} (due soon), ${invoiceOverdue.invoiceNumber} (overdue), ${invoiceOverdueWithReminders.invoiceNumber} (overdue, full reminder history)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
