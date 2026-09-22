import FreightFormContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Freight Calculator - Freight assist.online",
  description: "Get instant freight quotes for all TGE services.",
};


export default function CalculatorPage() {
  return (
    <div className="w-full">
      <FreightFormContent />
    </div>
  );
}
