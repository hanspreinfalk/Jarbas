import Markdown from "react-markdown";

/** Normalize AI / stored report briefs so react-markdown can parse them. */
export function normalizeReportMarkdown(input: string) {
  let text = String(input ?? "");
  if (!text) return "";

  // Some serializers store literal "\n" instead of real newlines.
  if (!text.includes("\n") && text.includes("\\n")) {
    text = text.replace(/\\n/g, "\n");
  }
  text = text.replace(/\r\n?/g, "\n");

  // Ensure a blank line before ATX headings when missing.
  text = text.replace(/([^\n#])\n(#{1,6}[ \t]+\S)/g, "$1\n\n$2");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function ReportMarkdown({ content }: { content: string }) {
  const markdown = normalizeReportMarkdown(content);
  if (!markdown) return null;

  return (
    <div className="report-md text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h3 className="mb-2 mt-5 font-display text-lg font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-5 font-display text-base font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-2 mt-4 text-sm font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h4>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">
              {children}
            </h4>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-"));
            if (isBlock) {
              return (
                <code className="font-mono text-[12px] text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto border border-border bg-muted/50 p-3 last:mb-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 text-muted-foreground last:mb-0">
              {children}
            </blockquote>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
