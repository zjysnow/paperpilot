import { HTML_NS } from "../../utils/domHelpers";

function estimateDataUrlByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl.length;
  const payloadLength = dataUrl.length - commaIndex - 1;
  return Math.max(0, Math.floor((payloadLength * 3) / 4));
}

type ImageOptimizationMode = "screenshot" | "pdf-page";

type ImageOptimizationProfile = {
  maxDimension: number;
  maxLosslessBytes: number;
  maxPassthroughBytes: number;
  jpegQuality: number;
};

const IMAGE_OPTIMIZATION_PROFILES: Record<
  ImageOptimizationMode,
  ImageOptimizationProfile
> = {
  screenshot: {
    maxDimension: 2048,
    maxLosslessBytes: 2 * 1024 * 1024,
    maxPassthroughBytes: 4 * 1024 * 1024,
    jpegQuality: 0.88,
  },
  "pdf-page": {
    maxDimension: 3072,
    maxLosslessBytes: 8 * 1024 * 1024,
    maxPassthroughBytes: 12 * 1024 * 1024,
    jpegQuality: 0.95,
  },
};

async function optimizeImageDataUrl(
  win: Window,
  dataUrl: string,
  options: { mode?: ImageOptimizationMode } = {},
): Promise<string> {
  const { maxDimension, maxLosslessBytes, maxPassthroughBytes, jpegQuality } =
    IMAGE_OPTIMIZATION_PROFILES[options.mode || "screenshot"];

  try {
    const ImageCtor = win.Image as typeof Image;
    const img = new ImageCtor();
    img.src = dataUrl;
    await img.decode();

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return dataUrl;

    const sourceBytes = estimateDataUrlByteLength(dataUrl);
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const needsResize = targetWidth !== width || targetHeight !== height;
    if (!needsResize && sourceBytes <= maxLosslessBytes) {
      return dataUrl;
    }

    const canvas = win.document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return dataUrl;
    ctx.imageSmoothingEnabled = true;
    (
      ctx as CanvasRenderingContext2D & {
        imageSmoothingQuality?: "low" | "medium" | "high";
      }
    ).imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const pngDataUrl = canvas.toDataURL("image/png");
    if (estimateDataUrlByteLength(pngDataUrl) <= maxLosslessBytes) {
      return pngDataUrl;
    }
    if (!needsResize && sourceBytes <= maxPassthroughBytes) {
      return dataUrl;
    }
    return canvas.toDataURL("image/jpeg", jpegQuality);
  } catch (err) {
    ztoolkit.log("Screenshot optimize failed:", err);
    return dataUrl;
  }
}

async function captureScreenshotSelection(win: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const doc = win.document;
    const container = doc.body || doc.documentElement;
    if (!container) {
      resolve(null);
      return;
    }

    const overlay = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    overlay.id = "llm-screenshot-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      width: "100vw",
      height: "100vh",
      zIndex: "10000",
      cursor: "crosshair",
      background: "rgba(0, 0, 0, 0.3)",
    });

    const instructions = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    Object.assign(instructions.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0, 0, 0, 0.8)",
      color: "white",
      padding: "12px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "10001",
      pointerEvents: "none",
    });
    instructions.textContent = "Click and drag to select a region, then release";

    const cancelBtn = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    Object.assign(cancelBtn.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#dc2626",
      color: "white",
      border: "none",
      padding: "10px 24px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
      zIndex: "10001",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      lineHeight: "1",
      minWidth: "120px",
    });
    cancelBtn.textContent = "Cancel (Esc)";

    const selection = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    Object.assign(selection.style, {
      position: "absolute",
      border: "2px dashed #2563eb",
      background: "rgba(37, 99, 235, 0.2)",
      pointerEvents: "none",
      display: "none",
    });

    overlay.append(instructions, cancelBtn, selection);
    container.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let isSelecting = false;
    let isReady = false;
    let resolved = false;

    const cleanup = () => {
      overlay.remove();
      doc.removeEventListener("keydown", onKeyDown);
    };

    const safeResolve = (value: string | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(value);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") safeResolve(null);
    };

    doc.addEventListener("keydown", onKeyDown);
    cancelBtn.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      safeResolve(null);
    });

    setTimeout(() => {
      isReady = true;
    }, 200);

    overlay.addEventListener("mousedown", (e: MouseEvent) => {
      if (!isReady || e.target === cancelBtn) return;
      e.preventDefault();
      e.stopPropagation();
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = "0px";
      selection.style.height = "0px";
      selection.style.display = "block";
    });

    overlay.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isSelecting) return;
      e.preventDefault();
      const currentX = e.clientX;
      const currentY = e.clientY;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      selection.style.left = `${left}px`;
      selection.style.top = `${top}px`;
      selection.style.width = `${width}px`;
      selection.style.height = `${height}px`;
    });

    overlay.addEventListener("mouseup", async (e: MouseEvent) => {
      if (!isReady || !isSelecting) return;
      e.preventDefault();
      e.stopPropagation();
      isSelecting = false;
      const endX = e.clientX;
      const endY = e.clientY;
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      if (width < 20 || height < 20) {
        selection.style.display = "none";
        return;
      }
      overlay.style.display = "none";
      try {
        const dataUrl = await captureRegion(win, left, top, width, height);
        safeResolve(dataUrl);
      } catch (err) {
        ztoolkit.log("Screenshot capture failed:", err);
        safeResolve(null);
      }
    });
  });
}

async function captureRegion(
  win: Window,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const readerFrame = win.document.querySelector(
      'iframe[src*="reader"]',
    ) as HTMLIFrameElement | null;
    let targetDoc = win.document;
    if (readerFrame?.contentDocument) {
      targetDoc = readerFrame.contentDocument;
    }
    const pdfCanvas = targetDoc.querySelector(
      ".pdfViewer canvas, .canvasWrapper canvas, canvas.pdfViewer",
    ) as HTMLCanvasElement | null;
    if (pdfCanvas) {
      const canvasRect = pdfCanvas.getBoundingClientRect();
      const relX = x - canvasRect.left;
      const relY = y - canvasRect.top;
      const scaleX = pdfCanvas.width / canvasRect.width;
      const scaleY = pdfCanvas.height / canvasRect.height;
      const srcX = Math.max(0, relX * scaleX);
      const srcY = Math.max(0, relY * scaleY);
      const srcWidth = Math.min(width * scaleX, pdfCanvas.width - srcX);
      const srcHeight = Math.min(height * scaleY, pdfCanvas.height - srcY);
      if (srcWidth > 0 && srcHeight > 0) {
        const tempCanvas = win.document.createElement(
          "canvas",
        ) as HTMLCanvasElement;
        tempCanvas.width = srcWidth;
        tempCanvas.height = srcHeight;
        const ctx = tempCanvas.getContext("2d") as CanvasRenderingContext2D | null;
        if (ctx) {
          ctx.drawImage(
            pdfCanvas,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            0,
            0,
            srcWidth,
            srcHeight,
          );
          return tempCanvas.toDataURL("image/png");
        }
      }
    }

    const canvas = win.document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    if ("drawWindow" in ctx) {
      (
        ctx as CanvasRenderingContext2D & {
          drawWindow: (
            win: Window,
            x: number,
            y: number,
            w: number,
            h: number,
            bg: string,
          ) => void;
        }
      ).drawWindow(win, x, y, width, height, "white");
      return canvas.toDataURL("image/png");
    }
    return null;
  } catch (err) {
    ztoolkit.log("Capture region error:", err);
    return null;
  }
}

export { optimizeImageDataUrl, captureScreenshotSelection, captureRegion };
