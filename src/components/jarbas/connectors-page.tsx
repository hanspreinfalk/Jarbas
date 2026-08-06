import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ComposioToolkit = {
  name: string;
  slug: string;
  meta?: {
    description?: string;
    logo?: string;
    categories?: { id: string; name: string }[];
    tools_count?: number;
  };
  no_auth?: boolean;
};

type ConnectedAccount = {
  id: string;
  label: string;
  email: string;
};

type ConnectedToolkit = {
  toolkit: ComposioToolkit;
  accounts: ConnectedAccount[];
};

type ToolkitListResponse = {
  items: ComposioToolkit[];
  nextCursor: string | null;
  totalPages: number;
  currentPage: number;
  totalItems: number;
};

const PAGE_SIZE = 24;
const CONNECTED_KEY = "jarbas.connected-toolkits.v2";

function makeAccount(toolkitName: string, index: number): ConnectedAccount {
  const n = index + 1;
  const slug = toolkitName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return {
    id: `${Date.now()}-${n}-${Math.random().toString(36).slice(2, 7)}`,
    label: n === 1 ? "Primary" : `Account ${n}`,
    email: `you${n === 1 ? "" : n}@${slug || "app"}.com`,
  };
}

function loadConnected(): ConnectedToolkit[] {
  try {
    const raw = localStorage.getItem(CONNECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConnectedToolkit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ToolkitLogo({ toolkit }: { toolkit: ComposioToolkit }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-background">
      {toolkit.meta?.logo ? (
        <img
          src={toolkit.meta.logo}
          alt=""
          className="size-6 object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">
          {toolkit.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

function ManageAccountsDialog({
  open,
  connection,
  onOpenChange,
  onAddAccount,
  onDisconnectAccount,
  onDisconnectAll,
}: {
  open: boolean;
  connection: ConnectedToolkit | null;
  onOpenChange: (open: boolean) => void;
  onAddAccount: () => void;
  onDisconnectAccount: (accountId: string) => void;
  onDisconnectAll: () => void;
}) {
  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ToolkitLogo toolkit={connection.toolkit} />
            <span className="min-w-0">
              <span className="block truncate">{connection.toolkit.name}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Manage accounts
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>
            Add more accounts or disconnect any of them.
          </DialogDescription>
        </DialogHeader>

        <div className="border border-border">
          {connection.accounts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No accounts connected.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {connection.accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {account.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-none text-muted-foreground hover:text-destructive"
                    onClick={() => onDisconnectAccount(account.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none sm:flex-1"
            onClick={onAddAccount}
          >
            <Plus className="size-3.5" />
            Add account
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-1"
            onClick={onDisconnectAll}
          >
            Disconnect all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectorsPage() {
  const [items, setItems] = useState<ComposioToolkit[]>([]);
  const [connected, setConnected] = useState<ConnectedToolkit[]>(loadConnected);
  const [managingSlug, setManagingSlug] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const cursorByPage = useRef<Map<number, string | undefined>>(
    new Map([[1, undefined]]),
  );
  const [nextReady, setNextReady] = useState(false);

  const connectedSlugs = new Set(connected.map((item) => item.toolkit.slug));
  const managing = connected.find((item) => item.toolkit.slug === managingSlug) ?? null;

  useEffect(() => {
    localStorage.setItem(CONNECTED_KEY, JSON.stringify(connected));
  }, [connected]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
      cursorByPage.current = new Map([[1, undefined]]);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setNextReady(false);
      try {
        const response = await invoke<ToolkitListResponse>(
          "list_composio_toolkits",
          {
            cursor: cursorByPage.current.get(page) ?? null,
            limit: PAGE_SIZE,
            search: search || null,
          },
        );
        if (cancelled) return;
        setItems(Array.isArray(response.items) ? response.items : []);
        setTotalPages(Math.max(1, response.totalPages));
        setTotalItems(response.totalItems);
        if (response.nextCursor) {
          cursorByPage.current.set(page + 1, response.nextCursor);
          setNextReady(true);
        } else {
          setNextReady(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setItems([]);
        setNextReady(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  function connectToolkit(toolkit: ComposioToolkit) {
    setConnected((prev) => {
      const existing = prev.find((item) => item.toolkit.slug === toolkit.slug);
      if (existing) {
        setManagingSlug(toolkit.slug);
        return prev;
      }
      const next: ConnectedToolkit = {
        toolkit,
        accounts: [makeAccount(toolkit.name, 0)],
      };
      setManagingSlug(toolkit.slug);
      return [next, ...prev];
    });
  }

  function addAccount(slug: string) {
    setConnected((prev) =>
      prev.map((item) => {
        if (item.toolkit.slug !== slug) return item;
        return {
          ...item,
          accounts: [
            ...item.accounts,
            makeAccount(item.toolkit.name, item.accounts.length),
          ],
        };
      }),
    );
  }

  function disconnectAccount(slug: string, accountId: string) {
    setConnected((prev) =>
      prev
        .map((item) => {
          if (item.toolkit.slug !== slug) return item;
          return {
            ...item,
            accounts: item.accounts.filter((account) => account.id !== accountId),
          };
        })
        .filter((item) => item.accounts.length > 0),
    );
  }

  function disconnectAll(slug: string) {
    setConnected((prev) => prev.filter((item) => item.toolkit.slug !== slug));
    setManagingSlug(null);
  }

  const canGoPrev = page > 1 && !loading;
  const canGoNext = page < totalPages && nextReady && !loading;
  const totalAccounts = connected.reduce(
    (sum, item) => sum + item.accounts.length,
    0,
  );

  return (
    <div className="animate-rise mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Tools</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Connectors
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Connect the tools you already use.
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {totalItems > 0
            ? `${totalItems.toLocaleString()} apps · Page ${page} of ${totalPages}`
            : loading
              ? "Loading catalog…"
              : "No apps"}
        </p>
      </div>

      <section className="mt-8 border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="label-caps text-muted-foreground">Connected</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Your apps
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {connected.length === 0
              ? "No apps connected yet."
              : `${connected.length} apps · ${totalAccounts} accounts`}
          </p>
        </div>
        {connected.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing connected yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map((connection) => (
              <article
                key={`connected-${connection.toolkit.slug}`}
                className="flex flex-col gap-3 border border-border bg-background px-3 py-3"
              >
                <div className="flex gap-3">
                  <ToolkitLogo toolkit={connection.toolkit} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {connection.toolkit.name}
                      </h2>
                      <span className="label-caps shrink-0 text-[10px] text-primary">
                        Connected
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connection.accounts.length} account
                      {connection.accounts.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-none"
                    onClick={() => setManagingSlug(connection.toolkit.slug)}
                  >
                    <Settings2 className="size-3.5" />
                    Manage
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    onClick={() => addAccount(connection.toolkit.slug)}
                    title="Add account"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools…"
          className="h-10 rounded-none border-border bg-card pl-9"
        />
      </div>

      {error ? (
        <div className="mt-6 border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Could not load connectors. {error}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-36 animate-pulse border border-border bg-card"
                  />
                ))
              : items.length === 0
                ? (
                    <div className="col-span-full border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                      No tools match your search.
                    </div>
                  )
                : items.map((toolkit) => {
                    const isConnected = connectedSlugs.has(toolkit.slug);
                    const category = toolkit.meta?.categories?.[0]?.name;
                    return (
                      <article
                        key={toolkit.slug}
                        className="flex flex-col gap-3 border border-border bg-card px-3 py-3"
                      >
                        <div className="flex gap-3">
                          <ToolkitLogo toolkit={toolkit} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                                {toolkit.name}
                              </h2>
                              {isConnected ? (
                                <span className="label-caps shrink-0 text-[10px] text-primary">
                                  Connected
                                </span>
                              ) : toolkit.no_auth ? (
                                <span className="label-caps shrink-0 text-[10px] text-muted-foreground">
                                  No auth
                                </span>
                              ) : null}
                            </div>
                            {category ? (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {category}
                              </p>
                            ) : null}
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {toolkit.meta?.description ?? toolkit.slug}
                            </p>
                          </div>
                        </div>
                        {isConnected ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full rounded-none"
                            onClick={() => setManagingSlug(toolkit.slug)}
                          >
                            <Settings2 className="size-3.5" />
                            Manage accounts
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full rounded-none"
                            onClick={() => connectToolkit(toolkit)}
                          >
                            Connect
                          </Button>
                        )}
                      </article>
                    );
                  })}
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border border-border bg-card px-3 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {(page - 1) * PAGE_SIZE + (items.length ? 1 : 0)}–
              {(page - 1) * PAGE_SIZE + items.length} of{" "}
              {totalItems.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                disabled={!canGoPrev}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </Button>
              <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                disabled={!canGoNext}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ManageAccountsDialog
        open={Boolean(managing)}
        connection={managing}
        onOpenChange={(open) => {
          if (!open) setManagingSlug(null);
        }}
        onAddAccount={() => {
          if (managingSlug) addAccount(managingSlug);
        }}
        onDisconnectAccount={(accountId) => {
          if (managingSlug) disconnectAccount(managingSlug, accountId);
        }}
        onDisconnectAll={() => {
          if (managingSlug) disconnectAll(managingSlug);
        }}
      />
    </div>
  );
}
