# Gentle Reminders

We can build the first version almost entirely on free tiers, prove that customers want it, and only introduce paid infrastructure when usage/customer revenue requires it.

🏗️ Product architecture

I'd make the first version a lightweight invoice follow-up SaaS, not a full invoicing system.

                    ┌──────────────────────┐
                    │      Customer        │
                    │  Agency / Consultant │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Web Dashboard    │
                    │      Next.js         │
                    └──────────┬───────────┘
                               │
                         HTTPS / REST
                               │
                               ▼
                    ┌──────────────────────┐
                    │      API Server      │
                    │ Node.js + TypeScript │
                    └───────┬───────┬──────┘
                            │       │
                 ┌──────────┘       └──────────┐
                 ▼                             ▼
       ┌──────────────────┐          ┌──────────────────┐
       │   PostgreSQL     │          │   Job Scheduler  │
       │  users/invoices  │          │  cron/background │
       │ reminders/events │          │      jobs        │
       └──────────────────┘          └────────┬─────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ Email Service    │
                                    │ reminder sender  │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                      Client's customer

What the product actually does

The first MVP only needs this:

Create invoice
     ↓
Set amount + due date + client email
     ↓
Choose reminder sequence
     ↓
System waits
     ↓
Due date passes
     ↓
Send reminder
     ↓
Wait
     ↓
Send next reminder
     ↓
Mark paid / stop reminders

That's it.

1. Frontend

Next.js + TypeScript

Pages:

/login
/dashboard
/invoices
/invoices/new
/invoices/:id
/settings
/templates

Dashboard:

┌──────────────────────────────────────────┐
│ Outstanding: $42,500                     │
│ Overdue: $12,800                         │
│ Paid this month: $31,400                 │
├──────────────────────────────────────────┤
│ Invoice      Client        Due     Status │
│ INV-001      ABC Inc       Aug 20  🔴     │
│ INV-002      XYZ LLC       Aug 27  🟡     │
│ INV-003      Acme           Sep 04  🟢     │
└──────────────────────────────────────────┘

You can host the frontend on a free deployment tier initially.

2. Backend

I'd use:

Node.js + TypeScript + Fastify

or Express if you prefer.

I'd personally use Fastify because this is a small API-heavy service.

Core APIs:

POST   /auth/register
POST   /auth/login

GET    /invoices
POST   /invoices
GET    /invoices/:id
PATCH  /invoices/:id
DELETE /invoices/:id

POST   /invoices/:id/mark-paid

GET    /reminder-sequences
POST   /reminder-sequences

GET    /events

3. Database

PostgreSQL

Tables:

users
organizations
clients
invoices
reminder_sequences
reminder_steps
reminder_events
email_templates
subscriptions

Basic relationship:

Organization
   │
   ├── Users
   │
   ├── Clients
   │
   └── Invoices
          │
          └── Reminder Events

Invoice

id
organization_id
client_id
invoice_number
amount
currency
issue_date
due_date
status
paid_at
created_at

Reminder step

id
sequence_id
delay_days
template_id
enabled

Example:

Step 1 → 2 days after due date
Step 2 → 7 days after due date
Step 3 → 14 days after due date

4. The most important part: the scheduler

This is where the actual product lives.

We don't need Kafka, RabbitMQ, Kubernetes, etc. 😄

For MVP:

Cron
 ↓
Find invoices needing action
 ↓
Create reminder event
 ↓
Send email
 ↓
Record result

For example, every hour:

SELECT invoices
WHERE status = 'OVERDUE'
AND next_reminder_at <= NOW()

Then:

invoice
   ↓
determine next reminder
   ↓
generate email
   ↓
send
   ↓
update next_reminder_at

This can initially run as a scheduled serverless function / cron job.

5. Email architecture

For MVP:

Your backend
     ↓
Email provider
     ↓
Client's customer

Email body:

Subject:
Friendly reminder — Invoice INV-1042

Hi John,

Just a quick reminder that invoice INV-1042
for $4,500 was due on August 25.

You can make the payment here:

[Pay Invoice]

Thanks,
ABC Agency

Important

We don't need to process payments ourselves.

The invoice can simply contain:

payment_url

which points to their existing Stripe/QuickBooks payment page.

That keeps our system much simpler.

6. Free-tier architecture 💰

This is the part you were asking about.

A realistic $0 starting stack can look like:

Frontend
   ↓
Next.js
   ↓
Free hosting

Backend
   ↓
Node.js / TypeScript
   ↓
Free hosting/serverless tier

Database
   ↓
PostgreSQL free tier

Authentication
   ↓
Managed auth/free tier

Scheduled jobs
   ↓
Free cron/scheduler allowance

Email
   ↓
Email provider's free allowance

The important thing is that we don't need to purchase a VPS, domain, Redis, Kafka, Kubernetes, Twilio, etc. on day one.

For development:

Your Mac
 ↓
Docker
 ↓
PostgreSQL

So even the local development environment costs nothing.

7. Multi-tenancy

From day one I'd make it SaaS-ready.

Every important record gets:

organization_id

Example:

Invoice
├── id
├── organization_id
├── client_id
├── amount
└── due_date

So:

Agency A
 ├── Invoice 1
 ├── Invoice 2

Agency B
 ├── Invoice 3
 ├── Invoice 4

Agency A can never query Agency B's invoices.

That's important both technically and for your eventual resume.

8. Email tracking

Later we can add:

sent
delivered
opened
clicked
bounced

But I'd not build that first.

MVP only needs:

sent
failed

Then once customers care about analytics, add tracking.

9. Authentication

Use managed authentication rather than building passwords yourself.

Architecture:

User
 ↓
Auth provider
 ↓
JWT/session
 ↓
Your API
 ↓
organization_id

Support:

 Email/password

 Google login

Google login can be added later.

10. Payment architecture

Don't build billing into V1.

First:

Customer
 ↓
Uses product
 ↓
Likes it
 ↓
You ask for payment

Once someone agrees:

Stripe
 ↓
Subscription
 ↓
Webhook
 ↓
Your backend
 ↓
subscription_status

Then:

active
trialing
past_due
cancelled

This is another reason we can start at $0.

We're not paying for payment infrastructure before having customers.

11. Integrations — DON'T start with them

This is where I want to keep us disciplined.

Do NOT start by building:

QuickBooks
Xero
Stripe
FreshBooks
Wave
HubSpot

Instead:

V1

User manually enters:

Client
Invoice
Amount
Due date
Payment URL

That's enough to validate whether people want the follow-up automation.

V2

Add:

QuickBooks

because then the product becomes:

"Connect QuickBooks and automatically handle overdue follow-ups."

Much stronger.

12. Later architecture

Once we have paying customers:

                  ┌───────────────┐
                  │   Next.js     │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ API Gateway   │
                  └───────┬───────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
       Auth Service   Invoice API   Webhook API
            │             │             │
            └─────────────┼─────────────┘
                          ▼
                    PostgreSQL
                          │
                          ▼
                     Job Queue
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Email       Retry Worker   Analytics

But we absolutely don't need that complexity now.

🧠 The actual MVP I'd build

Version 0.1:

Authentication
     +
Create clients
     +
Create invoices
     +
Set reminder sequence
     +
Automatic email reminders
     +
Mark invoice paid
     +
Dashboard

That's approximately one focused product, rather than an entire accounting platform.

User flow

Sign up
  ↓
Create Client
  ↓
Create Invoice
  ↓
Set due date
  ↓
Choose:

2 days overdue
7 days overdue
14 days overdue
  ↓
Activate
  ↓
System handles the rest

And that's enough to put in front of our first five prospects.

💡 One important change I'd make to our earlier plan

Before we even finish the dashboard, we can build a fake/manual prototype.

Example:

Landing page
     ↓
"Join early access"
     ↓
We manually create their invoice/reminder
     ↓
They receive the emails
     ↓
They tell us whether it's useful

That means we could potentially validate the business before spending weeks building the automation engine.

So our sequence should be:

Prospects → conversations → landing page/demo → 1–3 pilot users → MVP → paid customers → integrations.

That's the safest path to keeping our initial development cost at $0 while still testing whether there's a real business here. 🚀


can u just build ui pics ?? not code.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/793872eb-ee22-4314-aab8-f44fc5d174af).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
