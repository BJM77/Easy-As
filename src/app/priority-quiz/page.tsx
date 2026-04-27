import PriorityQuizPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Priority Quiz - FreightMate",
  description: "Test your knowledge of the Priority freight network.",
};

export default function PriorityQuizPage() {
  return <PriorityQuizPageContent />;
}
