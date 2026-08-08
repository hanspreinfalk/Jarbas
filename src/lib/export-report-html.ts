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
  }
  .jarbas-report-export {
    max-width: 56rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    box-sizing: border-box;
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
  @media print {
    .jarbas-report-export {
      max-width: none;
      padding: 0;
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
