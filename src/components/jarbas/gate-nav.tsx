import { useAuth, useClerk, useSession, UserButton } from "@clerk/clerk-react";
import { LogOut, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/jarbas/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jarbasClerkAppearance } from "@/lib/clerk-appearance";
import { getAuthRedirectUrl } from "@/lib/auth-origin";

function userButtonAppearance() {
  return {
    ...jarbasClerkAppearance,
    elements: {
      ...jarbasClerkAppearance.elements,
      rootBox: "flex! items-center!",
      userButtonBox: "flex! items-center!",
      userButtonTrigger: "rounded-none! focus:shadow-none! focus:ring-0!",
      userButtonAvatarBox: "size-7! rounded-none!",
    },
  };
}

function PendingGateUserButton() {
  const clerk = useClerk();
  const { session } = useSession();
  const user = session?.user;
  const imageUrl = user?.imageUrl;
  const label = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 rounded-none p-0"
            aria-label="Open account menu"
          />
        }
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="size-7 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex size-7 items-center justify-center bg-sky text-[11px] font-semibold text-navy">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-none">
        <DropdownMenuItem
          className="rounded-none"
          onClick={() => clerk.openUserProfile()}
        >
          <UserRound className="size-3.5" />
          Manage account
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-none"
          onClick={() => {
            void clerk.signOut({ redirectUrl: getAuthRedirectUrl("/") });
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GateUserButton() {
  // Pending sessions (choose-organization right after sign-up) must count as
  // signed-in, or the profile control disappears on OrgGate.
  const { isLoaded, userId } = useAuth({ treatPendingAsSignedOut: false });
  const { session } = useSession();

  if (!isLoaded || !userId) return null;

  // Clerk's UserButton can hide itself while the session task is pending.
  if (session?.status === "pending") {
    return <PendingGateUserButton />;
  }

  return (
    <UserButton
      userProfileMode="modal"
      afterSignOutUrl={getAuthRedirectUrl("/")}
      appearance={userButtonAppearance()}
    />
  );
}

/** Top chrome for pre-app gates (auth, org, onboarding, permissions). */
export function GateNav({ stepLabel }: { stepLabel: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
          J
        </span>
        <span className="truncate font-display text-base tracking-tight text-foreground">
          Jarbas
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="label-caps hidden text-muted-foreground sm:block">
          {stepLabel}
        </p>
        <ThemeToggle align="end" className="min-w-28" />
        <GateUserButton />
      </div>
    </header>
  );
}
