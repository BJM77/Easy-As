import AboutTGEPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About TGE - Just Easy",
  description: "Learn about Team Global Express services, infrastructure, and values.",
};

export default function AboutTGEPage() {
  return <AboutTGEPageContent />;
}
