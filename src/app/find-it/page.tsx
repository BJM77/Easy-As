import FindItPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Find It - Freight assist.online",
  description: "Scan a QR code to get instant directions.",
};

export default function FindItPage() {
  return <FindItPageContent />;
}
