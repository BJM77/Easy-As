"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FreightForm from "@/app/calculator/page-content";
import BulkPageContent from "@/app/bulk/page-content";
import MultiPageContent from "@/app/multi/page-content";
import LegDiscountPageContent from "@/app/leg-discount/page-content";
import CompetitorComparisonPageContent from "@/app/competitor-comparison/page-content";

const MODES = [
  { value: "standard", label: "Standard" },
  { value: "bulk", label: "Bulk" },
  { value: "multi", label: "Multi-leg" },
  { value: "leg-discount", label: "Leg discount" },
  { value: "compare", label: "Compare" },
] as const;

export default function CalculatorV2Content() {
  const [mode, setMode] = useState<string>("standard");

  return (
    <div className="w-full">
      <Tabs value={mode} onValueChange={setMode} className="w-full">
        <div className="px-2 pt-3 sm:px-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:flex-wrap">
            {MODES.map((m) => (
              <TabsTrigger key={m.value} value={m.value} className="w-full sm:w-auto">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {/* Each mode renders the original page's content component unchanged,
            so maths and results are identical to the original pages. */}
        <TabsContent value="standard"><FreightForm /></TabsContent>
        <TabsContent value="bulk"><BulkPageContent /></TabsContent>
        <TabsContent value="multi"><MultiPageContent /></TabsContent>
        <TabsContent value="leg-discount"><LegDiscountPageContent /></TabsContent>
        <TabsContent value="compare"><CompetitorComparisonPageContent /></TabsContent>
      </Tabs>
    </div>
  );
}
