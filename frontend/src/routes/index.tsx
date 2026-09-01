import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, CalendarClock, MailCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — ${APP_TAGLINE}` },
      {
        name: "description",
        content:
          "NudgePay automatically follows up on overdue invoices by email so you don't have to chase clients yourself.",
      },
      { property: "og:title", content: `${APP_NAME} — ${APP_TAGLINE}` },
      {
        property: "og:description",
        content: "Automatic, friendly invoice follow-ups — set a reminder sequence once and forget it.",
      },
    ],
  }),
  component: LandingPage,
});

const steps = [
  {
    icon: Wallet,
    title: "Add your invoices",
    description: "Track invoices you've already sent, however you already send them — no accounting integration required.",
  },
  {
    icon: CalendarClock,
    title: "Choose a reminder sequence",
    description: "Pick when follow-ups go out — e.g. 2, 7 and 14 days after the due date. Set it once per client type.",
  },
  {
    icon: MailCheck,
    title: "NudgePay runs itself",
    description: "Friendly reminders go out automatically until the invoice is marked paid. Nothing to babysit.",
  },
];

function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (isHydrated && user) {
      navigate({ to: "/dashboard" });
    }
  }, [isHydrated, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            N
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Start free</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center sm:pt-20">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Get paid without the chasing.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            {APP_NAME} automatically follows up on overdue invoices while you focus on your business.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">
                Start free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-card/50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.title} className="rounded-xl border border-border bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            NudgePay doesn't process payments — it just chases them.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Keep using whatever payment link you already send. We just make sure it doesn't get forgotten.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link to="/signup">
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
