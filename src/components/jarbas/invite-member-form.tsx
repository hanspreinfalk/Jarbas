import { useState, type FormEvent } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clerkErrorMessage } from "@/lib/auth-origin";
import { companyEmailError } from "@/lib/company-email";

export function InviteMemberForm({
  className,
}: {
  className?: string;
}) {
  const { organization, isLoaded } = useOrganization();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!organization || busy) return;

    const address = email.trim();
    const validationError = companyEmailError(address);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await organization.inviteMember({
        emailAddress: address,
        role: "org:member",
      });
      setSuccess(`Invitation sent to ${address}.`);
      setEmail("");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded) {
    return (
      <p className="text-sm text-muted-foreground">Loading organization…</p>
    );
  }

  if (!organization) {
    return (
      <p className="text-sm text-muted-foreground">
        Select an organization to invite teammates.
      </p>
    );
  }

  return (
    <form className={className} onSubmit={(e) => void handleSubmit(e)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="invite-email" className="label-caps text-muted-foreground">
            Work email
          </label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="name@company.com"
            className="h-10 rounded-none bg-cream"
            disabled={busy}
          />
        </div>
        <Button
          type="submit"
          className="rounded-none sm:mt-7"
          disabled={busy || !email.trim()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserPlus className="size-3.5" />
          )}
          {busy ? "Sending…" : "Invite"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Company email only. Personal providers like Gmail are blocked.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-2 text-sm text-foreground">{success}</p>
      ) : null}
    </form>
  );
}
