import { useEffect, useRef, useState, type FormEvent } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { Building2, Mail } from "lucide-react";
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

function roleLabel(role: string): string {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role.replace(/^org:/, "").replace(/_/g, " ");
}

export function OrgGate() {
  const { user } = useUser();
  const {
    isLoaded,
    createOrganization,
    setActive,
    userMemberships,
    userInvitations,
  } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: {
      infinite: true,
      status: "pending",
    },
  });
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const memberships = userMemberships.data ?? [];
  const invitations = userInvitations.data ?? [];
  const listsLoading =
    !isLoaded || userMemberships.isLoading || userInvitations.isLoading;
  const listError =
    userInvitations.error?.message ?? userMemberships.error?.message ?? null;
  const hasChoices = memberships.length > 0 || invitations.length > 0;
  const createExpanded = showCreate || !hasChoices;

  useEffect(() => {
    if (name) return;
    const suggestion = suggestedOrgName(user?.primaryEmailAddress?.emailAddress);
    if (suggestion) setName(suggestion);
  }, [name, user?.primaryEmailAddress?.emailAddress]);

  // Expand create when there are no invites/memberships to pick from.
  useEffect(() => {
    if (listsLoading) return;
    if (!hasChoices) setShowCreate(true);
  }, [hasChoices, listsLoading]);

  // Join/accept only needs setActive. Create needs createOrganization too.
  const canActivate = isLoaded && !!setActive;
  const canCreate = canActivate && !!createOrganization;

  async function activateOrganization(organizationId: string, label: string) {
    if (!setActive) return;
    await withTimeout(
      setActive({
        organization: organizationId,
        navigate: async () => undefined,
      }),
      12_000,
      label,
    );
  }

  async function handleJoinMembership(organizationId: string) {
    if (!canActivate || !setActive || submittingRef.current) return;

    submittingRef.current = true;
    setBusy(true);
    setBusyId(organizationId);
    setError(null);

    try {
      await activateOrganization(organizationId, "Opening organization");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
      setBusyId(null);
      submittingRef.current = false;
    }
  }

  async function handleAcceptInvitation(
    invitationId: string,
    organizationId: string,
    accept: () => Promise<unknown>,
  ) {
    if (!canActivate || !setActive || submittingRef.current) return;

    submittingRef.current = true;
    setBusy(true);
    setBusyId(invitationId);
    setError(null);

    try {
      // Clerk: accept() creates membership; setActive completes choose-organization.
      await withTimeout(accept(), 12_000, "Accepting invitation");
      await Promise.all([
        userInvitations.revalidate?.() ?? Promise.resolve(),
        userMemberships.revalidate?.() ?? Promise.resolve(),
      ]);
      try {
        await activateOrganization(organizationId, "Opening organization");
      } catch {
        // Membership may lag briefly; refresh and retry once.
        await userMemberships.revalidate?.();
        await activateOrganization(organizationId, "Opening organization");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
      setBusyId(null);
      submittingRef.current = false;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canCreate || !createOrganization || !setActive || submittingRef.current) {
      return;
    }

    const orgName = name.trim();
    if (!orgName) {
      setError("Enter an organization name.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setBusyId("create");
    setError(null);

    try {
      // Do not pass slug - this Clerk instance has organization slugs disabled.
      const organization = await withTimeout(
        createOrganization({ name: orgName }),
        12_000,
        "Creating organization",
      );
      await activateOrganization(organization.id, "Activating organization");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
      setBusyId(null);
      submittingRef.current = false;
    }
  }

  const title = hasChoices
    ? "Choose your organization"
    : "Create your organization";
  const subtitle = hasChoices
    ? "Join a workspace you were invited to, continue with one you already belong to, or create a new one."
    : "Organizations keep teams, agents, and delivery work in one place.";

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <GateNav stepLabel="02 · Organization" />

      <div className="jarbas-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="animate-rise w-full text-center">
            <p className="label-caps text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>

          {listsLoading ? (
            <p className="animate-fade-soft mt-10 label-caps text-muted-foreground">
              Loading workspaces
            </p>
          ) : (
            <div className="animate-fade-soft mt-8 w-full space-y-6">
              {invitations.length > 0 ? (
                <section className="space-y-3">
                  <p className="label-caps text-muted-foreground">Invitations</p>
                  <ul className="space-y-2">
                    {invitations.map((invitation) => {
                      const org = invitation.publicOrganizationData;
                      const pending = busy && busyId === invitation.id;
                      return (
                        <li key={invitation.id}>
                          <button
                            type="button"
                            disabled={busy || !canActivate}
                            onClick={() =>
                              void handleAcceptInvitation(
                                invitation.id,
                                org.id,
                                () => invitation.accept(),
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-3 border border-border bg-cream px-3 py-3 text-left transition-colors",
                              "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
                            )}
                          >
                            {org.hasImage ? (
                              <img
                                src={org.imageUrl}
                                alt=""
                                className="size-9 shrink-0 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center bg-sky text-navy">
                                <Mail className="size-4" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {org.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                Invited as {roleLabel(invitation.role)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-navy">
                              {pending ? "Joining…" : "Join"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {memberships.length > 0 ? (
                <section className="space-y-3">
                  <p className="label-caps text-muted-foreground">
                    Your organizations
                  </p>
                  <ul className="space-y-2">
                    {memberships.map((membership) => {
                      const org = membership.organization;
                      const pending = busy && busyId === org.id;
                      return (
                        <li key={membership.id}>
                          <button
                            type="button"
                            disabled={busy || !canActivate}
                            onClick={() => void handleJoinMembership(org.id)}
                            className={cn(
                              "flex w-full items-center gap-3 border border-border bg-cream px-3 py-3 text-left transition-colors",
                              "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
                            )}
                          >
                            {org.hasImage ? (
                              <img
                                src={org.imageUrl}
                                alt=""
                                className="size-9 shrink-0 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center bg-sky text-navy">
                                <Building2 className="size-4" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {org.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                Continue as {roleLabel(membership.role)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-navy">
                              {pending ? "Opening…" : "Continue"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {hasChoices && !createExpanded ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 w-full rounded-none"
                  disabled={busy}
                  onClick={() => setShowCreate(true)}
                >
                  Create a new organization
                </Button>
              ) : null}

              {createExpanded ? (
                <section className="space-y-3">
                  {hasChoices ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="label-caps text-muted-foreground">
                        Create new
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        disabled={busy}
                        onClick={() => setShowCreate(false)}
                      >
                        Hide
                      </button>
                    </div>
                  ) : null}

                  <form
                    className="space-y-4"
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
                        disabled={busy || !canCreate}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="h-10 w-full rounded-none"
                      disabled={!canCreate || busy || !name.trim()}
                    >
                      {busy && busyId === "create"
                        ? "Creating…"
                        : "Create organization"}
                    </Button>
                  </form>
                </section>
              ) : null}

              {error || listError ? (
                <p
                  role="alert"
                  className={cn(
                    "border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                  )}
                >
                  {error ?? listError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
