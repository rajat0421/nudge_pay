/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/modules/email/templates";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  console.log("Seeding NudgePay development data...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const organization = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Digital Agency",
      timezone: "America/New_York",
      currency: "USD",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      passwordHash,
      firstName: "Jamie",
      lastName: "Rivera",
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
    update: {},
    create: { organizationId: organization.id, userId: owner.id, role: "OWNER" },
  });

  // Idempotency: wipe this seed organization's dependent data (in FK-safe
  // order) before recreating it fresh, so re-running the seed against the
  // same Supabase database never hits a unique-constraint conflict and
  // always leaves the same, predictable end state.
  await prisma.reminderEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reminderStep.deleteMany({
    where: { reminderSequence: { organizationId: organization.id } },
  });
  await prisma.emailTemplate.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reminderSequence.deleteMany({ where: { organizationId: organization.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });

  const [clientPaid, clientDueSoon, clientOverdue, clientOverdueReminders, clientDraft] =
    await Promise.all([
      prisma.client.create({
        data: {
          organizationId: organization.id,
          name: "Dana Whitfield",
          companyName: "Bluebird Marketing",
          email: "ap@bluebirdmarketing.example.com",
        },
      }),
      prisma.client.create({
        data: {
          organizationId: organization.id,
          name: "Marcus Bell",
          companyName: "Fenwick & Holt",
          email: "finance@fenwickholt.example.com",
        },
      }),
      prisma.client.create({
        data: {
          organizationId: organization.id,
          name: "Priya Nair",
          companyName: "Northstar Studio",
          email: "accounts@northstarstudio.example.com",
        },
      }),
      prisma.client.create({
        data: {
          organizationId: organization.id,
          name: "Tobias Krause",
          companyName: "Harborline Logistics",
          email: "billing@harborline.example.com",
        },
      }),
      prisma.client.create({
        data: {
          organizationId: organization.id,
          name: "Elise Moreau",
          companyName: "Moreau Consulting",
          email: "elise@moreauconsulting.example.com",
        },
      }),
    ]);

  // Reminder sequence: +2 / +7 / +14 days, using the default professional templates.
  const sequence = await prisma.reminderSequence.create({
    data: {
      organizationId: organization.id,
      name: "Standard 3-step chase",
      description: "Friendly nudge, follow-up, then a final reminder.",
      isActive: true,
    },
  });

  const steps = [];
  for (const [index, template] of DEFAULT_TEMPLATES.entries()) {
    const emailTemplate = await prisma.emailTemplate.create({
      data: {
        organizationId: organization.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
      },
    });
    const step = await prisma.reminderStep.create({
      data: {
        reminderSequenceId: sequence.id,
        stepOrder: index + 1,
        delayDays: template.delayDays,
        emailTemplateId: emailTemplate.id,
      },
    });
    steps.push(step);
  }

  const invoicePaid = await prisma.invoice.create({
    data: {
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
  });

  const invoiceDueSoon = await prisma.invoice.create({
    data: {
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
  });

  const invoiceOverdue = await prisma.invoice.create({
    data: {
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
  });

  const invoiceOverdueWithReminders = await prisma.invoice.create({
    data: {
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
  });

  await prisma.invoice.create({
    data: {
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
  });

  // Seed scheduled/sent reminder events for the invoices above without
  // triggering the live worker to actually email these fake addresses.
  const step1 = steps[0]!;
  const step2 = steps[1]!;
  const step3 = steps[2]!;

  await prisma.reminderEvent.createMany({
    data: [
      // Due-soon invoice: both steps still pending, in the future.
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
      // Just-overdue invoice: step 1 already sent, step 2 pending soon.
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
      // Long-overdue invoice: full history — sent, sent, one failed retry.
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
    ],
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      action: "seed.completed",
      entityType: "Organization",
      entityId: organization.id,
      metadata: { invoices: 5, clients: 5 },
    },
  });

  console.log("Seed complete.");
  console.log("  Login: owner@example.com / password123");
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(`  Invoices: ${invoicePaid.invoiceNumber} (paid), ${invoiceDueSoon.invoiceNumber} (due soon), ${invoiceOverdue.invoiceNumber} (overdue), ${invoiceOverdueWithReminders.invoiceNumber} (overdue, full reminder history)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
