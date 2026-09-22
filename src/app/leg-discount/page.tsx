import LegDiscountPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Leg Discount Calculator - Freight assist.online",
  description: "Reverse-calculate the required KG rate to meet a target price for a freight leg.",
};

export default function LegDiscountPage() {
  return (
    <div className="w-full">
      <LegDiscountPageContent />
    </div>
  );
}
