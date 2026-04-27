import ProposalEditorPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Proposal Editor - Just Easy",
  description: "Create and edit professional sales proposals.",
};

export default function ProposalEditorPage() {
  return <ProposalEditorPageContent />;
}
