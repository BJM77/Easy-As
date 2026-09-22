import MultiPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Multi-Leg Calculator - Freight assist.online",
  description: "Calculate and compare multi-leg freight costs against direct routes.",
};

export default function MultiPage() {
  return <MultiPageContent />;
}
