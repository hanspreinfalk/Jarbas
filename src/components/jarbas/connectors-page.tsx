import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";

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

type ToolkitListResponse = {
  items: ComposioToolkit[];
  nextCursor: string | null;
  totalPages: number;
  currentPage: number;
  totalItems: number;
};

const PAGE_SIZE = 24;

export function ConnectorsPage() {
  const [items, setItems] = useState<ComposioToolkit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorByPage = useRef<Map<number, string | undefined>>(
    new Map([[1, undefined]]),
  );
  const [nextReady, setNextReady] = useState(false);

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
  }, [page]);

  const canGoPrev = page > 1 && !loading;
  const canGoNext = page < totalPages && nextReady && !loading;

  return (
    <div className="animate-rise mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Composio</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Connectors
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Connect the tools you already use so Jarbas can act across your stack.
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

      {error ? (
        <div className="mt-10 border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Could not load connectors. {error}
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-28 animate-pulse border border-border bg-card"
                  />
                ))
              : items.map((toolkit) => {
                  const category = toolkit.meta?.categories?.[0]?.name;
                  return (
                    <article
                      key={toolkit.slug}
                      className="flex gap-3 border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/50"
                    >
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {toolkit.name}
                          </h2>
                          {toolkit.no_auth ? (
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
    </div>
  );
}
