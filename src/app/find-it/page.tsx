import FindItPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Find It - FreightAssist.Online",
  description: "Scan a QR code to get instant directions.",
};

export default function FindItPage() {
  return <FindItPageContent />;
}
