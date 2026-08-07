import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OrganizationSwitcher } from "@clerk/clerk-react";
import { Check, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { APP_TABS, type AppTabId } from "@/lib/app-tabs";
import { jarbasClerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/utils";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function AppHeaderActions({
  activeId,
  onNavigate,
}: {
  activeId: AppTabId;
  onNavigate: (id: AppTabId) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APP_TABS;
    return APP_TABS.filter((tab) => tab.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSearchOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen]);

  function goTo(id: AppTabId) {
    onNavigate(id);
    setSearchOpen(false);
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/"
          appearance={{
            ...jarbasClerkAppearance,
            elements: {
              ...jarbasClerkAppearance.elements,
              organizationSwitcherPopoverActionButton__createOrganization:
                "hidden!",
            },
          }}
        />
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-none p-0 sm:max-w-md"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search pages</DialogTitle>
            <DialogDescription>Jump to a page in Jarbas.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages…"
              className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) {
                  event.preventDefault();
                  goTo(results[0].id);
                }
              }}
            />
            <Kbd>esc</Kbd>
          </div>
          <ul className="max-h-72 overflow-y-auto p-2">
            {results.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                No pages match.
              </li>
            ) : (
              results.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === activeId;
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => goTo(tab.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                        active && "bg-muted",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {tab.label}
                      </span>
                      {active ? (
                        <Check className="size-3.5 shrink-0 text-foreground" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Enter to open · Esc to close
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
