import UpdateRasPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Update RAS - Admin | LedgerLight",
  description: "Update Remote Area Surcharges for IPEC and Priority networks.",
};

export default function UpdateRasPage() {
  return <UpdateRasPageContent />;
}
