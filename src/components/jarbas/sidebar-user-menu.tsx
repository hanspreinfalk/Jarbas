import { useClerk, useUser } from "@clerk/clerk-react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAndClearLocalAuth } from "@/lib/auth-origin";
import { cn } from "@/lib/utils";

function initialsFromName(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function SidebarUserMenu() {
  const clerk = useClerk();
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return (
      <div className="flex h-[3.25rem] w-full items-center gap-2.5 border border-border bg-background px-2.5 py-2 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
        <span className="size-7 shrink-0 bg-muted" />
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="block h-3.5 w-24 bg-muted" />
          <span className="mt-1.5 block h-3 w-28 bg-muted" />
        </span>
      </div>
    );
  }

  const name = user.fullName || user.username || "Account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const imageUrl = user.imageUrl;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex h-auto w-full items-center justify-start gap-2.5 rounded-none border-border bg-background px-2.5 py-2 text-left",
              "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0",
            )}
            aria-label="Open account menu"
          />
        }
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="size-7 shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center bg-sky text-[11px] font-semibold text-navy">
            {initialsFromName(name, email)}
          </span>
        )}
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="block truncate text-sm font-semibold tracking-tight">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {email}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-44 rounded-none">
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
            void signOutAndClearLocalAuth(clerk);
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
