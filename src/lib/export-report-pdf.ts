import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "report"
  );
}

/** Light-theme tokens so PDF export is always black text on white. */
const PDF_LIGHT_VARS: Record<string, string> = {
  "--background": "#ffffff",
  "--foreground": "#0a0a0a",
  "--card": "#ffffff",
  "--card-foreground": "#0a0a0a",
  "--popover": "#ffffff",
  "--popover-foreground": "#0a0a0a",
  "--primary": "#080870",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f7f5ee",
  "--secondary-foreground": "#0a0a0a",
  "--muted": "#f7f5ee",
  "--muted-foreground": "#5c5c66",
  "--accent": "#bce2ff",
  "--accent-foreground": "#080870",
  "--border": "#e6e4dc",
  "--input": "#e6e4dc",
  "--ring": "#080870",
  "--navy": "#080870",
  "--cream": "#f7f5ee",
  "--sky": "#bce2ff",
  "--ink": "#0a0a0a",
};

type PdfBlock = { top: number; bottom: number };

function forceLightThemeForPdf(doc: Document, element: HTMLElement) {
  doc.documentElement.classList.remove("dark");
  doc.body.classList.remove("dark");

  for (const node of doc.querySelectorAll(".dark")) {
    node.classList.remove("dark");
  }

  for (const [name, value] of Object.entries(PDF_LIGHT_VARS)) {
    doc.documentElement.style.setProperty(name, value);
    element.style.setProperty(name, value);
  }

  element.style.backgroundColor = "#ffffff";
  element.style.color = "#0a0a0a";
}

/** Atomic blocks that must not be sliced across PDF pages (unless taller than a page). */
function collectPdfBlocks(root: HTMLElement): PdfBlock[] {
  const rootRect = root.getBoundingClientRect();
  const blocks: PdfBlock[] = [];

  for (const node of root.querySelectorAll<HTMLElement>("[data-pdf-block]")) {
    const rect = node.getBoundingClientRect();
    const top = Math.round(rect.top - rootRect.top);
    const bottom = Math.round(rect.bottom - rootRect.top);
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) continue;
    if (bottom - top < 8) continue;
    blocks.push({ top, bottom });
  }

  blocks.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  return blocks;
}

function scaleBlocks(blocks: PdfBlock[], scaleY: number): PdfBlock[] {
  return blocks.map((block) => ({
    top: Math.round(block.top * scaleY),
    bottom: Math.round(block.bottom * scaleY),
  }));
}

/**
 * Choose a page end that never cuts through a pdf-block.
 * If idealEnd lands inside a block, snap to that block's top (move whole block
 * to the next page) unless the block started on this page and is taller than
 * one page — then we have to hard-cut.
 *
 * Prefers the innermost (smallest) block containing the cut so a long
 * section wrapper does not force a mid-card slice.
 */
function pickPageEnd(
  pageStart: number,
  idealEnd: number,
  canvasHeight: number,
  blocks: PdfBlock[],
): number {
  if (idealEnd >= canvasHeight) return canvasHeight;

  const minAdvance = Math.max(64, Math.floor((idealEnd - pageStart) * 0.25));

  // Innermost block containing the ideal cut.
  let containing: PdfBlock | null = null;
  for (const block of blocks) {
    if (idealEnd <= block.top || idealEnd >= block.bottom) continue;
    if (
      !containing ||
      block.bottom - block.top < containing.bottom - containing.top
    ) {
      containing = block;
    }
  }

  if (containing) {
    // Block started on a previous page and spans past the cut — unavoidable.
    if (containing.top < pageStart) {
      return Math.min(idealEnd, canvasHeight);
    }

    // Move the whole block to the next page.
    if (containing.top - pageStart >= minAdvance) {
      return containing.top;
    }

    // Block starts near pageStart; finish it on this page if it mostly fits.
    if (containing.bottom <= pageStart + (idealEnd - pageStart) * 1.2) {
      return Math.min(containing.bottom, canvasHeight);
    }
    return Math.min(idealEnd, canvasHeight);
  }

  // Ideal cut is in open space. Prefer ending at the bottom of the last block
  // fully contained on this page.
  let bestBottom = 0;
  for (const block of blocks) {
    if (block.top < pageStart) continue;
    if (block.bottom > idealEnd) break;
    if (block.bottom - pageStart >= minAdvance) bestBottom = block.bottom;
  }
  if (bestBottom > pageStart) return bestBottom;

  // Next block starts after idealEnd — break before it when possible.
  for (const block of blocks) {
    if (block.top <= pageStart) continue;
    if (block.top > idealEnd) {
      if (block.top - pageStart >= minAdvance) return block.top;
      break;
    }
  }

  return Math.min(idealEnd, canvasHeight);
}

export async function exportReportPdf(
  element: HTMLElement,
  filenameBase: string,
) {
  const cssBlocks = collectPdfBlocks(element);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDoc, clonedElement) => {
      forceLightThemeForPdf(clonedDoc, clonedElement);
    },
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  const scaleY = canvas.height / Math.max(element.scrollHeight, 1);
  const blocks = scaleBlocks(cssBlocks, scaleY);
  const pageHeightPx = (contentHeight / contentWidth) * canvas.width;

  let pageStart = 0;
  let pageIndex = 0;

  while (pageStart < canvas.height - 1) {
    const idealEnd = pageStart + pageHeightPx;
    const pageEnd = pickPageEnd(pageStart, idealEnd, canvas.height, blocks);
    const sliceHeight = Math.max(1, pageEnd - pageStart);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      pageStart,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const sliceMmHeight = (sliceHeight * contentWidth) / canvas.width;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      contentWidth,
      sliceMmHeight,
    );

    // Guarantee forward progress.
    pageStart = pageEnd > pageStart ? pageEnd : pageStart + sliceHeight;
    pageIndex += 1;
    if (pageIndex > 80) break;
  }

  pdf.save(`${slugify(filenameBase)}.pdf`);
}
