import { type ReactNode } from "react";
import {
  Download,
  MoreHorizontal,
  Pencil,
  ScrollText,
  Trash2,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function linesToList(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listToLines(value: string[] | undefined) {
  return (value ?? []).join("\n");
}

export function csvToList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function listToCsv(value: string[] | undefined) {
  return (value ?? []).join(", ");
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-caps text-muted-foreground">{children}</p>;
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    />
  );
}

export function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-none"
    />
  );
}

/** Alias used by detail pages */
export const FieldInput = TextInput;

type DetailTab = "details" | "ai";

/**
 * Clean detail-page actions: Cancel/Save while editing, otherwise a single ⋯ menu
 * for Analysis run, Edit, Export, and Delete.
 */
export function AnalysisItemToolbar({
  editing,
  saving,
  deleting,
  exporting,
  tab = "details",
  onTabChange,
  onEdit,
  onCancelEdit,
  onSave,
  onDeleteRequest,
  onExport,
  showAnalysisRun = true,
  showEdit = true,
  showDelete = true,
  showExport = true,
}: {
  editing: boolean;
  saving?: boolean;
  deleting?: boolean;
  exporting?: boolean;
  tab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDeleteRequest: () => void;
  onExport?: () => void;
  showAnalysisRun?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showExport?: boolean;
  /** @deprecated unused — kept so older call sites type-check during migration */
  leading?: ReactNode;
}) {
  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-none"
          disabled={saving}
          onClick={onCancelEdit}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-none"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    );
  }

  const viewingRun = tab === "ai";
  const canToggleRun = showAnalysisRun && Boolean(onTabChange);
  const canExport = showExport && Boolean(onExport);
  const hasItems = canToggleRun || showEdit || canExport || showDelete;
  if (!hasItems) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-none"
            aria-label="Actions"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-none">
        {canToggleRun ? (
          <DropdownMenuItem
            className="rounded-none"
            onClick={() => onTabChange?.(viewingRun ? "details" : "ai")}
          >
            <ScrollText className="size-3.5" />
            {viewingRun ? "Result" : "Analysis run"}
          </DropdownMenuItem>
        ) : null}
        {showEdit ? (
          <DropdownMenuItem
            className="rounded-none"
            onClick={() => {
              onTabChange?.("details");
              onEdit();
            }}
          >
            <Pencil className="size-3.5" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {canExport ? (
          <DropdownMenuItem
            className="rounded-none"
            disabled={exporting}
            onClick={() => {
              onTabChange?.("details");
              onExport?.();
            }}
          >
            <Download className="size-3.5" />
            {exporting ? "Exporting…" : "Export"}
          </DropdownMenuItem>
        ) : null}
        {showDelete && (canToggleRun || showEdit || canExport) ? (
          <DropdownMenuSeparator />
        ) : null}
        {showDelete ? (
          <DropdownMenuItem
            variant="destructive"
            className="rounded-none"
            disabled={deleting}
            onClick={onDeleteRequest}
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  deleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  deleting?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Keep
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-none"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
