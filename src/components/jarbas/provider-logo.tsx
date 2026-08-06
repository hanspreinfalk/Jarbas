import { useState } from "react";
import type { LlmProvider } from "@/lib/llm-settings";
import { cn } from "@/lib/utils";

const PROVIDER_DOMAINS: Record<LlmProvider, string> = {
  anthropic: "anthropic.com",
  openai: "openai.com",
  google: "gemini.google.com",
};

const PROVIDER_FALLBACK: Record<LlmProvider, string> = {
  anthropic: "A",
  openai: "O",
  google: "G",
};

function duckDuckGoIconUrl(domain: string) {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

export function ProviderLogo({
  provider,
  className,
}: {
  provider: LlmProvider;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const domain = PROVIDER_DOMAINS[provider];

  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center overflow-hidden border border-border bg-background",
        className,
      )}
      aria-hidden
    >
      {failed ? (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {PROVIDER_FALLBACK[provider]}
        </span>
      ) : (
        <img
          src={duckDuckGoIconUrl(domain)}
          alt=""
          className="size-4 object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
