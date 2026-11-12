import QRCode from "qrcode";

/** QR per serialized asset — PRD §5.12. The QR holds only an opaque
 *  internal asset URL (no personal data / secrets); access still goes
 *  through auth + authorization. */
export async function assetQrDataUrl(assetId: string, assetCode: string): Promise<string> {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/assets/${assetId}`;
  try {
    return await QRCode.toDataURL(url, { margin: 1, width: 200 });
  } catch {
    return "";
  }
}

export function assetQrText(assetCode: string): string {
  return assetCode;
}
