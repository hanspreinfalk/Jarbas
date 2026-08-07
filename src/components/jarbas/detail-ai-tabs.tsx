import { cn } from "@/lib/utils";

export function DetailAiTabs({
  tab,
  onTabChange,
}: {
  tab: "details" | "ai";
  onTabChange: (tab: "details" | "ai") => void;
}) {
  return (
    <div className="mt-4 inline-flex border border-border">
      {(
        [
          { id: "details", label: "Details" },
          { id: "ai", label: "AI" },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            tab === item.id
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
