import ZoneSbPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Zone SB Tool - Just Easy",
  description: "Direct zone-based freight rate calculations, bypassing standard postcode and suburb lookup.",
};

export default function ZoneSbPage() {
  return <ZoneSbPageContent />;
}
