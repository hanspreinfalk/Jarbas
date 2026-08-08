function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "report"
  );
}

/** Collect readable CSS from the live document (Vite/Tailwind injects same-origin sheets). */
function collectDocumentCss(): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        chunks.push(rule.cssText);
      }
    } catch {
      // Ignore cross-origin sheets.
    }
  }
  return chunks.join("\n");
}

const EXPORT_BASE_CSS = `
  :root {
    --background: #ffffff;
    --foreground: #0a0a0a;
    --card: #ffffff;
    --card-foreground: #0a0a0a;
    --popover: #ffffff;
    --popover-foreground: #0a0a0a;
    --primary: #080870;
    --primary-foreground: #ffffff;
    --secondary: #f7f5ee;
    --secondary-foreground: #0a0a0a;
    --muted: #f7f5ee;
    --muted-foreground: #5c5c66;
    --accent: #bce2ff;
    --accent-foreground: #080870;
    --border: #e6e4dc;
    --input: #e6e4dc;
    --ring: #080870;
    --navy: #080870;
    --cream: #f7f5ee;
    --sky: #bce2ff;
    --ink: #0a0a0a;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0a0a0a;
  }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  .jarbas-report-export {
    width: 100%;
    max-width: 56rem;
    margin: 0 auto;
    padding: 1.25rem 1rem 3rem;
    box-sizing: border-box;
    overflow-x: clip;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }
  .jarbas-report-export *,
  .jarbas-report-export *::before,
  .jarbas-report-export *::after {
    box-sizing: border-box;
  }
  .jarbas-report-export a {
    color: inherit;
    text-decoration: none;
  }
  .jarbas-report-export img,
  .jarbas-report-export canvas,
  .jarbas-report-export video,
  .jarbas-report-export iframe {
    max-width: 100%;
    height: auto;
  }
  .jarbas-report-export svg {
    max-width: 100%;
  }
  .jarbas-report-export pre,
  .jarbas-report-export code {
    max-width: 100%;
    overflow-x: auto;
  }
  .jarbas-report-export table {
    width: 100%;
    max-width: 100%;
  }
  .jarbas-report-export .recharts-wrapper,
  .jarbas-report-export .recharts-responsive-container {
    max-width: 100% !important;
  }
  /* Title + body first, meta chips below on phone / narrow tablet. */
  .jarbas-report-export [data-export-stack] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.75rem;
  }
  .jarbas-report-export [data-export-stack] > * {
    flex: 0 0 auto !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }
  @media (min-width: 640px) {
    .jarbas-report-export {
      padding: 2rem 1.25rem 3.5rem;
    }
  }
  @media (min-width: 768px) {
    .jarbas-report-export {
      padding: 2.5rem 1.5rem 4rem;
    }
    .jarbas-report-export [data-export-stack] {
      flex-direction: row !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
    }
    .jarbas-report-export [data-export-stack] > *:first-child {
      flex: 1 1 auto !important;
      width: auto !important;
      min-width: 16rem !important;
    }
    .jarbas-report-export [data-export-stack] > *:last-child:not(:only-child) {
      width: auto !important;
      flex: 0 0 auto !important;
    }
  }
  @media (max-width: 639px) {
    .jarbas-report-export {
      font-size: 15px;
    }
    .jarbas-report-export h1 {
      font-size: 1.5rem !important;
      line-height: 1.25;
    }
    .jarbas-report-export h2 {
      font-size: 1.05rem !important;
    }
  }
  @media print {
    .jarbas-report-export {
      max-width: none;
      padding: 0;
      overflow: visible;
    }
    [data-pdf-block] {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn interactive controls into static markup safe for a standalone HTML file. */
function prepareCloneForExport(clone: HTMLElement) {
  clone.querySelectorAll("[data-export-ignore]").forEach((node) => {
    node.remove();
  });

  // Preserve index entries: convert in-page nav buttons/links to plain anchors.
  clone.querySelectorAll("a[href^='#']").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    anchor.removeAttribute("onclick");
  });

  clone.querySelectorAll("button").forEach((button) => {
    const href = button.getAttribute("data-export-href");
    if (href?.startsWith("#")) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.className = button.className;
      anchor.innerHTML = button.innerHTML;
      button.replaceWith(anchor);
      return;
    }
    // Drop toolbar/action buttons; keep their absence from the document body.
    button.remove();
  });
}

/** Download a self-contained HTML snapshot of a report element. */
export async function exportReportHtml(
  element: HTMLElement,
  filenameBase: string,
  title?: string,
) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("jarbas-report-export");
  prepareCloneForExport(clone);

  const docTitle = title?.trim() || filenameBase || "Report";
  const css = `${EXPORT_BASE_CSS}\n${collectDocumentCss()}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(docTitle)}</title>
<style>
${css}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>
`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(filenameBase)}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
