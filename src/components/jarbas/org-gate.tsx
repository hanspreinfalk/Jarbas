import { CreateOrganization } from "@clerk/clerk-react";

export function OrgGate() {
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

          <div className="animate-fade-soft mt-8 w-full [&_.cl-cardBox]:mx-auto [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full">
            <CreateOrganization
              skipInvitationScreen
              afterCreateOrganizationUrl="/"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
