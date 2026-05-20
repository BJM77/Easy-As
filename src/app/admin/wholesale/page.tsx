import WholesalePageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Wholesale Calculator - Admin",
  description: "Calculate B2B Priority rates with special wholesale logic.",
};

export default function WholesalePage() {
  return (
    <div className="w-full">
      <WholesalePageContent />
    </div>
  );
}
