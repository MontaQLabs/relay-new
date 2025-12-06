import QRCode from "qrcode";

/**
 * Generate a QR code as a data URL from a wallet address
 * @param address - The wallet address to encode in the QR code
 * @param size - The size of the QR code (default: 280)
 * @returns Promise<string> - A data URL of the generated QR code
 */
export async function generateQRCode(
  address: string,
  size: number = 280
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(address, {
      width: size,
      margin: 2,
      color: {
        dark: "#4B4B4B", // Dark gray color for the QR code (matching the design)
        light: "#FFFFFF", // White background
      },
      errorCorrectionLevel: "M",
    });
    return dataUrl;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw error;
  }
}

/**
 * Generate a QR code as a canvas element
 * @param address - The wallet address to encode in the QR code
 * @param canvas - The canvas element to draw on
 * @param size - The size of the QR code (default: 280)
 */
export async function generateQRCodeToCanvas(
  address: string,
  canvas: HTMLCanvasElement,
  size: number = 280
): Promise<void> {
  try {
    await QRCode.toCanvas(canvas, address, {
      width: size,
      margin: 2,
      color: {
        dark: "#4B4B4B",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Failed to generate QR code to canvas:", error);
    throw error;
  }
}

/**
 * Download a composite image containing the QR code and promotional content
 * @param qrDataUrl - The QR code data URL
 * @param address - The wallet address to display
 * @param tokenSymbol - The token symbol (e.g., "USDT", "ETH")
 * @param filename - The filename for the downloaded image (default: "relay-wallet-qr.png")
 */
export async function downloadQRWithPromo(
  qrDataUrl: string,
  address: string,
  tokenSymbol: string,
  filename: string = "relay-wallet-qr.png"
): Promise<void> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Canvas dimensions
  const width = 400;
  const height = 580;
  const padding = 30;
  const qrSize = 260;
  const borderRadius = 24;

  canvas.width = width;
  canvas.height = height;

  // Draw rounded rectangle background
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 0, 0, width, height, borderRadius);

  // Draw border
  ctx.strokeStyle = "#E5E5E5";
  ctx.lineWidth = 1;
  roundRectStroke(ctx, 0.5, 0.5, width - 1, height - 1, borderRadius);

  // Load and draw QR code
  const qrImage = new Image();
  qrImage.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = reject;
    qrImage.src = qrDataUrl;
  });

  const qrX = (width - qrSize) / 2;
  const qrY = padding + 20;
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Draw "Only accept XXX" text
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Only accept ${tokenSymbol}`, width / 2, qrY + qrSize + 30);

  // Draw wallet address (truncated in the middle)
  ctx.fillStyle = "#9CA3AF";
  ctx.font = "400 14px monospace";
  const truncatedAddress = truncateAddress(address);
  ctx.fillText(truncatedAddress, width / 2, qrY + qrSize + 60);

  // Draw separator line
  const separatorY = qrY + qrSize + 90;
  ctx.strokeStyle = "#E5E5E5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, separatorY);
  ctx.lineTo(width - padding, separatorY);
  ctx.stroke();

  // Draw promo section
  const promoY = separatorY + 30;

  // Relay Wallet text
  ctx.fillStyle = "#6B7280";
  ctx.font = "400 14px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Relay Wallet", padding + 10, promoY);

  // Tagline
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.fillText("Start your crypto journey here!", padding + 10, promoY + 25);

  // Draw small QR code for app (placeholder - just a simple pattern)
  const smallQrSize = 50;
  const smallQrX = width - padding - smallQrSize - 10;
  const smallQrY = promoY - 10;
  
  // Draw a simple placeholder pattern for the small QR
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 2;
  ctx.strokeRect(smallQrX, smallQrY, smallQrSize, smallQrSize);
  
  // Simple QR pattern inside
  const cellSize = smallQrSize / 7;
  ctx.fillStyle = "#1A1A1A";
  
  // Corner squares
  ctx.fillRect(smallQrX + cellSize, smallQrY + cellSize, cellSize * 2, cellSize * 2);
  ctx.fillRect(smallQrX + smallQrSize - cellSize * 3, smallQrY + cellSize, cellSize * 2, cellSize * 2);
  ctx.fillRect(smallQrX + cellSize, smallQrY + smallQrSize - cellSize * 3, cellSize * 2, cellSize * 2);

  // Trigger download
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * Truncate a wallet address to show first and last characters
 */
function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  const firstLine = address.slice(0, 20);
  const secondLine = address.slice(20);
  return `${firstLine}\n${secondLine}`;
}

/**
 * Draw a filled rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a stroked rounded rectangle
 */
function roundRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.stroke();
}
