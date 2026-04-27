"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Mic } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';


interface FunnelState {
  id: string;
  meetingSetup: string;
  openGeneral: string;
  openSpecific: string;
  closed: string;
  confirm: string;
  summary: string;
}

const createNewFunnel = (): FunnelState => ({
  id: `funnel-${Date.now()}`,
  meetingSetup: '',
  openGeneral: '',
  openSpecific: '',
  closed: '',
  confirm: '',
  summary: ''
});

export default function EngagePlanner() {
  const [openQuestions, setOpenQuestions] = useState('');
  const [closedQuestions, setClosedQuestions] = useState('');
  const [funnels, setFunnels] = useState<FunnelState[]>([]);

  const handleAddFunnel = () => {
    if (funnels.length < 4) {
      setFunnels(prev => [...prev, createNewFunnel()]);
    }
  };

  const handleRemoveFunnel = (id: string) => {
    setFunnels(prev => prev.filter(f => f.id !== id));
  };

  const handleFunnelChange = (id: string, field: keyof Omit<FunnelState, 'id'>, value: string) => {
    setFunnels(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  return (
    <div className="p-4 my-4 border rounded-lg space-y-6">
      <h3 className="text-lg font-semibold">Engage Planner</h3>
      
      <div className="my-4">
        
        <p className="text-xs text-muted-foreground text-center mt-1">A visual guide to the engagement funnel process.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="open-questions" className="text-base font-medium">Open Questions</Label>
          <Textarea
            id="open-questions"
            value={openQuestions}
            onChange={(e) => setOpenQuestions(e.target.value)}
            placeholder="List high-level open-ended questions to understand the customer's world..."
            rows={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="closed-questions" className="text-base font-medium">Closed Questions</Label>
          <Textarea
            id="closed-questions"
            value={closedQuestions}
            onChange={(e) => setClosedQuestions(e.target.value)}
            placeholder="List specific closed questions to confirm details or get clear answers..."
            rows={5}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
            <h4 className="text-base font-semibold">Drill Down Funnels</h4>
            <Button onClick={handleAddFunnel} variant="outline" size="sm" disabled={funnels.length >= 4}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Funnel
            </Button>
        </div>
        
        <Accordion type="multiple" className="w-full space-y-4">
            {funnels.map((funnel, index) => (
                 <Card key={funnel.id} className="bg-muted/30">
                     <CardHeader className="p-3">
                         <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-medium">Drill Down Funnel #{index + 1}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveFunnel(funnel.id)} aria-label={`Remove Funnel ${index + 1}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                         </div>
                     </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor={`funnel-setup-${index}`}>Meeting setup (WWHOA)</Label>
                            <Textarea id={`funnel-setup-${index}`} value={funnel.meetingSetup} onChange={(e) => handleFunnelChange(funnel.id, 'meetingSetup', e.target.value)} rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`funnel-open-gen-${index}`}>Open Questions General</Label>
                            <Textarea id={`funnel-open-gen-${index}`} value={funnel.openGeneral} onChange={(e) => handleFunnelChange(funnel.id, 'openGeneral', e.target.value)} rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`funnel-open-spec-${index}`}>Open Specific Questions</Label>
                            <Textarea id={`funnel-open-spec-${index}`} value={funnel.openSpecific} onChange={(e) => handleFunnelChange(funnel.id, 'openSpecific', e.target.value)} rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`funnel-closed-${index}`}>Closed Questions</Label>
                            <Textarea id={`funnel-closed-${index}`} value={funnel.closed} onChange={(e) => handleFunnelChange(funnel.id, 'closed', e.target.value)} rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`funnel-confirm-${index}`}>Confirm Anything Else</Label>
                            <Textarea id={`funnel-confirm-${index}`} value={funnel.confirm} onChange={(e) => handleFunnelChange(funnel.id, 'confirm', e.target.value)} rows={2} />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor={`funnel-summary-${index}`}>Summary</Label>
                            <Textarea id={`funnel-summary-${index}`} value={funnel.summary} onChange={(e) => handleFunnelChange(funnel.id, 'summary', e.target.value)} rows={2} />
                        </div>
                    </CardContent>
                 </Card>
            ))}
        </Accordion>
      </div>

    </div>
  );
}
