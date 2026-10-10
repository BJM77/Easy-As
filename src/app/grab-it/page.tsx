import GrabItPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Grab It - Freight assist.online",
  description: "Scan a QR code to instantly create a new sales lead.",
};

export default function GrabItPage() {
  return <GrabItPageContent />;
}
