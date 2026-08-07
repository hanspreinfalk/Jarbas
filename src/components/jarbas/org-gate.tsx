import { useEffect, useRef, useState, type FormEvent } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { GateNav } from "@/components/jarbas/gate-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clerkErrorMessage } from "@/lib/auth-origin";
import { cn } from "@/lib/utils";

function suggestedOrgName(email: string | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "";
  const cleaned = local.replace(/[._+-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Try again.`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function OrgGate() {
  const { user } = useUser();
  const { isLoaded, createOrganization, setActive, userMemberships } =
    useOrganizationList({
      userMemberships: { infinite: true },
    });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (name) return;
    const suggestion = suggestedOrgName(user?.primaryEmailAddress?.emailAddress);
    if (suggestion) setName(suggestion);
  }, [name, user?.primaryEmailAddress?.emailAddress]);

  // If an org already exists (e.g. create succeeded but UI hung), activate it.
  useEffect(() => {
    if (!isLoaded || !setActive || submittingRef.current) return;
    const existing = userMemberships.data?.[0]?.organization?.id;
    if (!existing) return;
    void withTimeout(
      setActive({
        organization: existing,
        navigate: async () => undefined,
      }),
      12_000,
      "Activating organization",
    ).catch((err) => {
      console.error("Failed to activate existing organization", err);
    });
  }, [isLoaded, setActive, userMemberships.data]);

  const ready = isLoaded && !!createOrganization && !!setActive;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !createOrganization || !setActive || submittingRef.current) {
      return;
    }

    const orgName = name.trim();
    if (!orgName) {
      setError("Enter an organization name.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      // Do not pass slug - this Clerk instance has organization slugs disabled.
      const organization = await withTimeout(
        createOrganization({ name: orgName }),
        12_000,
        "Creating organization",
      );
      await withTimeout(
        setActive({
          organization: organization.id,
          navigate: async () => undefined,
        }),
        12_000,
        "Activating organization",
      );
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <GateNav stepLabel="02 · Organization" />

      <div className="jarbas-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="animate-rise w-full text-center">
            <p className="label-caps text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">
              Create your organization
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Organizations keep teams, agents, and delivery work in one place.
            </p>
          </div>

          <form
            className="animate-fade-soft mt-8 w-full space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-2">
              <label
                htmlFor="org-name"
                className="label-caps text-muted-foreground"
              >
                Organization name
              </label>
              <Input
                id="org-name"
                type="text"
                autoComplete="organization"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your company name"
                className="h-10 rounded-none bg-cream"
                disabled={busy || !ready}
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-10 w-full rounded-none"
              disabled={!ready || busy || !name.trim()}
            >
              {busy ? "Creating…" : "Create organization"}
            </Button>

            {error ? (
              <p
                role="alert"
                className={cn(
                  "border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                )}
              >
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
