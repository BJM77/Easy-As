
import type { Metadata } from 'next';
import AiQuotePageContent from './page-content';

export const metadata: Metadata = {
  title: "AI Quote Assistant - Freight assist.online",
  description: "Chat with our natural language intelligence to generate freight quotes instantly.",
};

export default function AiQuoteAssistantPage() {
  return <AiQuotePageContent />;
}
