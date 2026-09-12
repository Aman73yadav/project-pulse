import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { getDemoPassword } from "@/lib/seed.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Studio Ops" },
      { name: "description", content: "Sign in to the agency project dashboard." },
      { property: "og:title", content: "Sign in — Studio Ops" },
      { property: "og:description", content: "Sign in to the agency project dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { label: "Admin · Asha Menon", email: "admin@velozity.test" },
  { label: "Project Manager · Priya Nair", email: "pm1@velozity.test" },
  { label: "Project Manager · Marcus Feld", email: "pm2@velozity.test" },
  { label: "Developer · Ravi Kumar", email: "dev1@velozity.test" },
  { label: "Developer · Sara Iqbal", email: "dev4@velozity.test" },
];
function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@velozity.test");
  const [password, setPassword] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    void getDemoPassword().then((result) => {
      setDemoPassword(result.password);
      setPassword((current) => current || result.password);
    });
  }, []);

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not sign in. Check the email and password.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/60 px-4 py-12">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Role-based internal tool
          </div>
          <h1 className="text-4xl font-semibold">Studio Ops</h1>
          <p className="max-w-md text-muted-foreground">
            Client projects, task progress and a live activity feed for the whole studio. What you
            see depends on your role — enforced on the server, not just hidden in the interface.
          </p>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">Demo accounts</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Password for all accounts: <span className="font-mono">{demoPassword}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(demoPassword);
                    void signIn(account.email, demoPassword);
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your studio email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void signIn(email.trim(), password);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
