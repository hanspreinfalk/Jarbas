import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

type ThemeValue = (typeof OPTIONS)[number]["value"];

export function ThemeToggle({
  align = "start",
  className,
}: {
  align?: "start" | "end";
  className?: string;
} = {}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = (mounted ? (theme ?? "system") : "system") as ThemeValue;
  const current = OPTIONS.find((option) => option.value === active) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "rounded-none justify-between gap-2 min-w-36",
              className,
            )}
          />
        }
      >
        <span className="flex items-center gap-2">
          <CurrentIcon className="size-3.5" />
          {current.label}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-36 rounded-none">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = active === value;
          return (
            <DropdownMenuItem
              key={value}
              className="rounded-none"
              onClick={() => setTheme(value)}
            >
              <Icon className="size-3.5" />
              <span className="flex-1">{label}</span>
              <Check
                className={cn(
                  "size-3.5 text-foreground",
                  selected ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
