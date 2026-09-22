import PdfExtractorPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "AI PDF Extractor - Admin",
  description: "Extract data from PDF documents using Generative AI.",
};

export default function PdfExtractorPage() {
  return <PdfExtractorPageContent />;
}
