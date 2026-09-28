import ZoneSBPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Zone SB - Freight assist.online",
  description: "Analyze competitor freight rates against all TGE spend bands using direct zone inputs.",
};

export default function ZoneSBPage() {
  return <ZoneSBPageContent />;
}
