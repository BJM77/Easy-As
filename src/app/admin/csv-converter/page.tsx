
import CsvConverterPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "JSON Creator - Admin",
  description: "Create JSON files from Excel or pasted data.",
};

export default function CsvConverterPage() {
  return <CsvConverterPageContent />;
}
