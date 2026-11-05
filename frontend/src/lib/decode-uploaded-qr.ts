import { BrowserQRCodeReader } from "@zxing/browser";
import jsQR from "jsqr";

/** Retry screenshots at readable sizes without sending the image to a server. */
export async function decodeUploadedQr(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const reader = new BrowserQRCodeReader();
    try { return (await reader.decodeFromImageElement(image)).getText(); } catch { /* Retry below. */ }
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const side = Math.min(width, height);
    // Keep the whole image first, then isolate square regions in screenshots.
    const regions = [
      [0, 0, width, height],
      [(width - side) / 2, (height - side) / 2, side, side],
      [0, 0, side, side],
      [width - side, height - side, side, side],
    ];
    for (const [x, y, w, h] of regions) {
      for (const edge of [800, 1600]) {
        // Yield between attempts so a large photo does not freeze the dialog.
        await new Promise(resolve => setTimeout(resolve, 0));
        const scale = edge / Math.max(w, h);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale) + 64;
        canvas.height = Math.round(h * scale) + 64;
        const context = canvas.getContext("2d");
        if (!context) continue;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = scale < 1;
        context.drawImage(image, x, y, w, h, 32, 32, canvas.width - 64, canvas.height - 64);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
        if (decoded?.data) return decoded.data;
        try { return reader.decodeFromCanvas(canvas).getText(); } catch { /* Try the next size/region. */ }
      }
    }
    throw new Error("No readable QR code found.");
  } finally { URL.revokeObjectURL(url); }
}
