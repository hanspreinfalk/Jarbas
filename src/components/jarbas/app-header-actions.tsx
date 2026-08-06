import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { APP_TABS, type AppTabId } from "@/lib/app-tabs";
import { MOCK_ORGS, type Org } from "@/lib/mock-orgs";
import { cn } from "@/lib/utils";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function slugifyOrgId(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "org";
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
  const [orgs, setOrgs] = useState<Org[]>(MOCK_ORGS);
  const [orgId, setOrgId] = useState(MOCK_ORGS[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const org = orgs.find((item) => item.id === orgId) ?? orgs[0];

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

  useEffect(() => {
    if (!createOpen) setNewOrgName("");
  }, [createOpen]);

  function goTo(id: AppTabId) {
    onNavigate(id);
    setSearchOpen(false);
  }

  function createOrg() {
    const name = newOrgName.trim();
    if (!name) return;

    const baseId = slugifyOrgId(name);
    let id = baseId;
    let suffix = 2;
    while (orgs.some((item) => item.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const next: Org = {
      id,
      name,
      detail: "1 employee · workspace",
    };

    setOrgs((current) => [...current, next]);
    setOrgId(next.id);
    setCreateOpen(false);
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-8 max-w-[12rem] items-center gap-1.5 border border-border bg-background px-2 text-left transition-colors hover:bg-muted sm:max-w-[14rem]"
              />
            }
          >
            <span className="flex size-5 shrink-0 items-center justify-center bg-primary text-[10px] font-semibold text-primary-foreground">
              {org.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight">
              {org.name}
            </span>
            <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-none">
            <DropdownMenuRadioGroup value={orgId} onValueChange={setOrgId}>
              <DropdownMenuLabel>Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orgs.map((item) => (
                <DropdownMenuRadioItem
                  key={item.id}
                  value={item.id}
                  className="rounded-none"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">
              Create organization
            </DialogTitle>
            <DialogDescription>
              Add a workspace for a new team or client.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createOrg();
            }}
          >
            <div className="grid gap-2">
              <label
                htmlFor="new-org-name"
                className="label-caps text-muted-foreground"
              >
                Name
              </label>
              <Input
                id="new-org-name"
                autoFocus
                value={newOrgName}
                onChange={(event) => setNewOrgName(event.target.value)}
                placeholder="Acme Partners"
                className="rounded-none"
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-none"
                disabled={!newOrgName.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
