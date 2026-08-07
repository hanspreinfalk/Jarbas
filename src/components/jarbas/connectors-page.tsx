import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@convex/_generated/api";
import { composioLogoUrl } from "@/lib/app-logos";

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

type ComposioConnectedAccount = {
  id: string;
  toolkitSlug: string;
  status: string;
  alias?: string | null;
  wordId?: string | null;
  label: string;
  detail: string;
};

type ConnectedToolkit = {
  toolkit: ComposioToolkit;
  accounts: ComposioConnectedAccount[];
};

type ToolkitListResponse = {
  items: ComposioToolkit[];
  nextCursor: string | null;
  totalPages: number;
  currentPage: number;
  totalItems: number;
};

type ConnectedAccountsResponse = {
  items: ComposioConnectedAccount[];
};

type ConnectLinkResponse = {
  redirectUrl: string;
  connectedAccountId: string;
  expiresAt?: string | null;
};

const PAGE_SIZE = 24;
const LEGACY_CONNECTED_KEY = "jarbas.connected-toolkits.v2";

function toolkitMeta(slug: string, catalog: ComposioToolkit[]): ComposioToolkit {
  const found = catalog.find((item) => item.slug === slug);
  if (found) return found;
  return {
    name: slug
      .split(/[_-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    slug,
    meta: {
      logo: composioLogoUrl(slug),
    },
  };
}

function ToolkitLogo({ toolkit }: { toolkit: ComposioToolkit }) {
  const logo = toolkit.meta?.logo ?? composioLogoUrl(toolkit.slug);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-background">
      {logo ? (
        <img
          src={logo}
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
  busy,
  onOpenChange,
  onAddAccount,
  onDisconnectAccount,
  onDisconnectAll,
}: {
  open: boolean;
  connection: ConnectedToolkit | null;
  busy: boolean;
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
            Add another account or disconnect an existing one.
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
                      {account.detail}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-none text-muted-foreground hover:text-destructive"
                    disabled={busy}
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
            disabled={busy}
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
            disabled={busy || connection.accounts.length === 0}
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
  const { user } = useUser();
  const ensureComposioUserId = useMutation(api.user.ensureComposioUserId);
  const composioUserId = user?.id ?? null;

  const [items, setItems] = useState<ComposioToolkit[]>([]);
  const [accounts, setAccounts] = useState<ComposioConnectedAccount[]>([]);
  const [connectedLoading, setConnectedLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [connectingToolkit, setConnectingToolkit] =
    useState<ComposioToolkit | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_CONNECTED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const refreshConnected = useCallback(async () => {
    if (!composioUserId) {
      setAccounts([]);
      setConnectedLoading(false);
      return;
    }

    setConnectedLoading(true);
    try {
      const response = await invoke<ConnectedAccountsResponse>(
        "list_composio_connected_accounts",
        { userId: composioUserId },
      );
      setAccounts(response.items);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectedLoading(false);
    }
  }, [composioUserId]);

  useEffect(() => {
    void refreshConnected();
  }, [refreshConnected]);

  useEffect(() => {
    function onFocus() {
      void refreshConnected();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refreshConnected();
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshConnected]);

  const connected = useMemo<ConnectedToolkit[]>(() => {
    const bySlug = new Map<string, ComposioConnectedAccount[]>();
    for (const account of accounts) {
      if (account.status !== "ACTIVE" && account.status !== "INITIALIZING" && account.status !== "INITIATED") {
        continue;
      }
      const list = bySlug.get(account.toolkitSlug) ?? [];
      list.push(account);
      bySlug.set(account.toolkitSlug, list);
    }

    return Array.from(bySlug.entries())
      .map(([slug, toolkitAccounts]) => ({
        toolkit: toolkitMeta(slug, items),
        accounts: toolkitAccounts.filter((account) => account.status === "ACTIVE").length
          ? toolkitAccounts.filter((account) => account.status === "ACTIVE")
          : toolkitAccounts,
      }))
      .sort((a, b) => a.toolkit.name.localeCompare(b.toolkit.name));
  }, [accounts, items]);

  const connectedSlugs = useMemo(
    () => new Set(connected.map((item) => item.toolkit.slug)),
    [connected],
  );
  const managing =
    connected.find((item) => item.toolkit.slug === managingSlug) ?? null;

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
      try {
        const cursor = cursorByPage.current.get(page);
        const response = await invoke<ToolkitListResponse>(
          "list_composio_toolkits",
          {
            cursor: cursor ?? null,
            limit: PAGE_SIZE,
            search: search || null,
          },
        );
        if (cancelled) return;
        setItems(response.items);
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

  async function startConnect(toolkit: ComposioToolkit) {
    if (!composioUserId) {
      setActionError("Sign in to connect apps.");
      return;
    }

    setConnectingToolkit(toolkit);
    setActionError(null);
    try {
      await ensureComposioUserId();
      const link = await invoke<ConnectLinkResponse>(
        "create_composio_connect_link",
        {
          userId: composioUserId,
          toolkitSlug: toolkit.slug,
        },
      );
      await openUrl(link.redirectUrl);
      setManagingSlug(toolkit.slug);
      await refreshConnected();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingToolkit(null);
    }
  }

  async function disconnectAccount(accountId: string) {
    setActionBusy(true);
    setActionError(null);
    try {
      await invoke("delete_composio_connected_account", { accountId });
      await refreshConnected();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function disconnectAll(slug: string) {
    const targets = accounts.filter((account) => account.toolkitSlug === slug);
    setActionBusy(true);
    setActionError(null);
    try {
      for (const account of targets) {
        await invoke("delete_composio_connected_account", {
          accountId: account.id,
        });
      }
      setManagingSlug(null);
      await refreshConnected();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  const canGoPrev = page > 1 && !loading;
  const canGoNext = page < totalPages && nextReady && !loading;
  const totalAccounts = connected.reduce(
    (sum, item) => sum + item.accounts.length,
    0,
  );
  const controlsBusy = actionBusy || connectingToolkit !== null;

  return (
    <div className="animate-rise mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Tools</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Connectors
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Connect the tools you already use. Connections request read-only
            access — Jarbas can view your data, not change it.
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

      {actionError ? (
        <div className="mt-6 border border-border bg-card px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <section className="mt-8 border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="label-caps text-muted-foreground">Connected</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Your apps
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {connectedLoading
              ? "Loading connections…"
              : connected.length === 0
                ? "No apps connected yet."
                : `${connected.length} apps · ${totalAccounts} accounts`}
          </p>
        </div>
        {connectedLoading ? (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`connected-skeleton-${index}`}
                className="h-28 animate-pulse border border-border bg-background"
              />
            ))}
          </div>
        ) : connected.length === 0 ? (
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
                    disabled={controlsBusy}
                    onClick={() => void startConnect(connection.toolkit)}
                    title="Add account"
                  >
                    {connectingToolkit?.slug === connection.toolkit.slug ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
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
              placeholder="Search apps..."
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
                            disabled={controlsBusy || toolkit.no_auth}
                            onClick={() => void startConnect(toolkit)}
                          >
                            {connectingToolkit?.slug === toolkit.slug ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="size-3.5" />
                            )}
                            {connectingToolkit?.slug === toolkit.slug
                              ? "Preparing…"
                              : "Connect"}
                          </Button>
                        )}
                      </article>
                    );
                  })}
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border border-border bg-card px-3 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {(page - 1) * PAGE_SIZE + (items.length ? 1 : 0)}-
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

      <Dialog
        open={Boolean(connectingToolkit)}
        onOpenChange={() => {
          // Block dismiss while preparing the connect link.
        }}
      >
        <DialogContent
          className="rounded-none sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              Connecting {connectingToolkit?.name ?? "app"}
            </DialogTitle>
            <DialogDescription>
              Preparing a read-only connection. The first connect for an app can
              take a few seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Working…</p>
              <p className="mt-0.5 text-muted-foreground">
                Setting up permissions, then opening sign-in in your browser.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ManageAccountsDialog
        open={Boolean(managing) && !connectingToolkit}
        connection={managing}
        busy={controlsBusy}
        onOpenChange={(open) => {
          if (!open) setManagingSlug(null);
        }}
        onAddAccount={() => {
          if (managing) void startConnect(managing.toolkit);
        }}
        onDisconnectAccount={(accountId) => {
          void disconnectAccount(accountId);
        }}
        onDisconnectAll={() => {
          if (managingSlug) void disconnectAll(managingSlug);
        }}
      />
    </div>
  );
}
