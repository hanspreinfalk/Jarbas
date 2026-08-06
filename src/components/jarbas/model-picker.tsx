import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  shortModelLabel,
  type LlmProvider,
  type LlmSettings,
} from "@/lib/llm-settings";
import { cn } from "@/lib/utils";

export function ModelPicker({
  settings,
  disabled,
  onSelect,
}: {
  settings: LlmSettings | null;
  disabled?: boolean;
  onSelect: (provider: LlmProvider, model: string) => void;
}) {
  const label = settings ? shortModelLabel(settings.model) : "Model";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || !settings}
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-[9.5rem] rounded-none px-2 text-xs font-medium"
            aria-label={
              settings
                ? `Model ${settings.providers.find((item) => item.id === settings.provider)?.label ?? ""} ${label}`
                : "Select model"
            }
            title={
              settings
                ? `${settings.providers.find((item) => item.id === settings.provider)?.label ?? ""} · ${settings.model}`
                : "Select model"
            }
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="min-w-44 rounded-none"
      >
        {(settings?.providers ?? []).map((provider) => (
          <DropdownMenuSub key={provider.id}>
            <DropdownMenuSubTrigger className="rounded-none">
              {provider.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48 rounded-none">
              {provider.models.map((model) => {
                const selected =
                  settings?.provider === provider.id && settings.model === model;
                return (
                  <DropdownMenuItem
                    key={model}
                    className={cn("rounded-none", selected && "bg-muted")}
                    onClick={() => onSelect(provider.id, model)}
                  >
                    <span className="flex-1">{shortModelLabel(model)}</span>
                    {selected ? (
                      <span className="text-[10px] text-muted-foreground">Selected</span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
