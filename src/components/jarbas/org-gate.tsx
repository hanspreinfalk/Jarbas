import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clerkErrorMessage } from "@/lib/auth-origin";
import { cn } from "@/lib/utils";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

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

export function OrgGate() {
  const { user } = useUser();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (name) return;
    const suggestion = suggestedOrgName(user?.primaryEmailAddress?.emailAddress);
    if (suggestion) setName(suggestion);
  }, [name, user?.primaryEmailAddress?.emailAddress]);

  const slug = useMemo(() => slugify(name), [name]);
  const ready = isLoaded && !!createOrganization && !!setActive;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !createOrganization || !setActive) return;

    const orgName = name.trim();
    if (!orgName) {
      setError("Enter an organization name.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const organization = await createOrganization({
        name: orgName,
        ...(slug ? { slug } : {}),
      });
      await setActive({ organization: organization.id });
    } catch (err) {
      setError(clerkErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
            J
          </span>
          <span className="font-display text-base tracking-tight text-foreground">
            Jarbas
          </span>
        </div>
        <p className="label-caps text-muted-foreground">02 · Organization</p>
      </header>

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
                placeholder="Acme Delivery"
                className="h-10 rounded-none bg-cream"
                disabled={busy || !ready}
                required
              />
            </div>

            {slug ? (
              <p className="text-xs text-muted-foreground">
                URL slug:{" "}
                <span className="font-medium text-foreground">{slug}</span>
              </p>
            ) : null}

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
