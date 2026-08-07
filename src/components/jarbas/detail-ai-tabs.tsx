import { Button } from "@/components/ui/button";

export type DetailViewTab = "details" | "ai";

/** Toggle between the saved result and the analysis transcript - lives in the top toolbar. */
export function AnalysisRunButton({
  tab,
  onTabChange,
  disabled,
}: {
  tab: DetailViewTab;
  onTabChange: (tab: DetailViewTab) => void;
  disabled?: boolean;
}) {
  const viewingRun = tab === "ai";
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-none"
      disabled={disabled}
      onClick={() => onTabChange(viewingRun ? "details" : "ai")}
    >
      {viewingRun ? "Result" : "Analysis run"}
    </Button>
  );
}
