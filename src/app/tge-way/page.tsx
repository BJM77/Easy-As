import TGEWayPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "The TGE Way - FreightAssist.Online",
  description: "Learn about the TGE sales process and methodology.",
};

export default function TGEWayPage() {
  return <TGEWayPageContent />;
}
