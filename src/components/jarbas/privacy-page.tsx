import { ArrowLeft } from "lucide-react";
import { ReportMarkdown } from "@/components/jarbas/report-markdown";
import type { AppTabId } from "@/lib/app-tabs";
import { PRIVACY_EXPLAINER_MARKDOWN } from "@/lib/privacy-explainer";

export function PrivacyPage({
  onNavigate,
}: {
  onNavigate: (id: AppTabId) => void;
}) {
  return (
    <div className="animate-rise mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate("settings")}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Settings
      </button>

      <p className="label-caps mt-4 text-muted-foreground">Trust</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        How Jarbas uses data
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        What stays on this device, what can go to the cloud, and the controls
        you already have.
      </p>

      <section className="mt-8 max-w-2xl">
        <ReportMarkdown content={PRIVACY_EXPLAINER_MARKDOWN} />
      </section>
    </div>
  );
}
