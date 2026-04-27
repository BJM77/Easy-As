"use client";

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserCheck } from 'lucide-react';

interface ExerciseAnswers {
    matrixPosition: string;
    why: string;
    comparison: string;
    strategies: string;
}

const exerciseQuestions = [
    { id: 'matrixPosition', label: '1. Where do you think your contacts are on the matrix?' },
    { id: 'why', label: '2. Why do you think this?' },
    { id: 'comparison', label: '3. How similar or different are these styles to yours?' },
    { id: 'strategies', label: '4. What influencing and rapport building strategies would work well for these contacts?' }
];

export default function PeopleReadingExercise() {
  const [answers, setAnswers] = useState<ExerciseAnswers>({
    matrixPosition: '',
    why: '',
    comparison: '',
    strategies: ''
  });

  const handleTextChange = (field: keyof ExerciseAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2 flex items-center">
        <UserCheck className="mr-2 h-5 w-5" />
        People Reading Exercise
      </h3>
      <p className="text-sm text-muted-foreground mb-4">Using one of your customers, answer the following questions.</p>
      <div className="space-y-4">
        {exerciseQuestions.map(q => (
            <div key={q.id} className="space-y-1">
                <Label htmlFor={q.id} className="font-medium">{q.label}</Label>
                <Textarea
                    id={q.id}
                    value={answers[q.id as keyof ExerciseAnswers]}
                    onChange={(e) => handleTextChange(q.id as keyof ExerciseAnswers, e.target.value)}
                    className="w-full"
                    rows={3}
                />
            </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">Be prepared to share with the group!</p>
    </div>
  );
}
