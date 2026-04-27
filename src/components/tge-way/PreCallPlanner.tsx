
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PlannerSection {
    id: 'what' | 'why' | 'how' | 'outcomes';
    letter: 'W' | 'W' | 'H' | 'O';
    title: string;
    placeholder: string;
}

const plannerSections: PlannerSection[] = [
    { id: 'what', letter: 'W', title: 'What we are here to do today...', placeholder: 'e.g., Expand our contacts, understand solution needs, identify next steps for upcoming MBR...' },
    { id: 'why', letter: 'W', title: 'Why is this important in?', placeholder: 'e.g., To ensure they fully understand our capabilities and services across all their business units...' },
    { id: 'how', letter: 'H', title: 'How we suggest the meeting is structured', placeholder: 'e.g., Re-position TGE, diagnose across new contacts, agree next steps...' },
    { id: 'outcomes', letter: 'O', title: 'Outcomes for both parties', placeholder: 'e.g., A solution presentation to a broader contact group and a format for the upcoming MBR...' }
];

export default function PreCallPlanner() {
  const [plannerState, setPlannerState] = useState<Record<string, string>>({
    what: '',
    why: '',
    how: '',
    outcomes: ''
  });

  const handleTextChange = (id: PlannerSection['id'], value: string) => {
    setPlannerState(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Pre Call Planner</h3>
      <p className="text-sm text-muted-foreground mb-4">Using the key information so far, let's prepare for the meeting.</p>
      <div className="space-y-4">
        {plannerSections.map(section => (
            <div key={section.id} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-foreground text-background flex items-center justify-center rounded-md font-bold text-xl">
                    {section.letter}
                </div>
                <div className="flex-grow space-y-1">
                    <Label htmlFor={section.id} className="font-medium">{section.title}</Label>
                    <Textarea
                        id={section.id}
                        value={plannerState[section.id]}
                        onChange={(e) => handleTextChange(section.id, e.target.value)}
                        placeholder={section.placeholder}
                        className="w-full"
                        rows={3}
                    />
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
