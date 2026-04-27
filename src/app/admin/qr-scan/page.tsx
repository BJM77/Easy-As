import QrScanPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "QR Code Scanner - Admin",
  description: "Scan QR codes and barcodes to inspect their raw data.",
};

export default function QrScanPage() {
  return <QrScanPageContent />;
}
