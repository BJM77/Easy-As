
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CustomerNeedsAnalysis() {
  const [tacticalNeeds, setTacticalNeeds] = useState('');
  const [strategicNeeds, setStrategicNeeds] = useState('');

  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Customer Knowledge: What do we really know?</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="tactical-needs" className="text-base font-medium text-center block">Tactical Needs</Label>
          <Textarea
            id="tactical-needs"
            value={tacticalNeeds}
            onChange={(e) => setTacticalNeeds(e.target.value)}
            placeholder="e.g., Reduce costs on the SYD-MEL lane, improve POD success rate, faster delivery times for B2C..."
            rows={8}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="strategic-needs" className="text-base font-medium text-center block">Strategic Needs</Label>
          <Textarea
            id="strategic-needs"
            value={strategicNeeds}
            onChange={(e) => setStrategicNeeds(e.target.value)}
            placeholder="e.g., Expand into the WA market, support a new product launch, improve overall supply chain resilience..."
            rows={8}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
