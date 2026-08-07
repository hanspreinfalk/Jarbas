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

export async function exportReportPdf(
  element: HTMLElement,
  filenameBase: string,
) {
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

  const imgData = canvas.toDataURL("image/png");
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
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
    heightLeft -= contentHeight;
  }

  pdf.save(`${slugify(filenameBase)}.pdf`);
}
