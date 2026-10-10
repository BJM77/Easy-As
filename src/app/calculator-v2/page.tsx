import CalculatorV2Content from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Calculator (beta) - FreightAssist.Online",
  description: "Test calculator with Standard, Bulk, Multi-leg, Leg discount and Compare modes.",
};

export default function CalculatorV2Page() {
  return (
    <div className="w-full">
      <CalculatorV2Content />
    </div>
  );
}
