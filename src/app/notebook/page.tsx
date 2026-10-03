
import NotebookPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Notebook - Freight assist.online",
  description: "A smart notebook for managing sales notes and strategy.",
};

export default function NotebookPage() {
  return <NotebookPageContent />;
}
