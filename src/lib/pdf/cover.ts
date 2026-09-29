import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

/** Render the first page as a JPEG thumbnail for the library shelf. */
export async function renderCover(doc: PDFDocumentProxy, width = 480): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  page.cleanup();
  return canvas.encode("jpeg", 82);
}
