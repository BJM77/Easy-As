
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResultStyle } from './CommunicationStyles';

const questions = [
  {
    id: 'q1',
    question: '1️⃣ When they are under pressure, what tends to matter most?',
    options: [
      { value: 'fast', label: 'Getting results and achieving goals' },
      { value: 'slow', label: 'Maintaining relationships and team harmony' },
    ],
  },
  {
    id: 'q2',
    question: '2️⃣ Do they prefer to make decisions:',
    options: [
      { value: 'fast', label: 'Quickly — act and adjust later' },
      { value: 'slow', label: 'Carefully — think and check before acting' },
    ],
  },
  {
    id: 'q3',
    question: '3️⃣ How do they usually communicate ideas?',
    options: [
      { value: 'fast', label: 'With enthusiasm and emotion' },
      { value: 'slow', label: 'With precision and structure' },
    ],
  },
  {
    id: 'q4',
    question: '4️⃣ In a meeting, they tend to:',
    options: [
      { value: 'fast', label: 'Lead the discussion and push for outcomes' },
      { value: 'slow', label: 'Listen, support, and build consensus' },
    ],
  },
  {
    id: 'q5',
    question: '5️⃣ On a team project, their natural role appears to be:',
    options: [
      { value: 'fast', label: 'The motivator or organiser' },
      { value: 'slow', label: 'The supporter or detail-checker' },
    ],
  },
  {
    id: 'q6',
    question: '6️⃣ They naturally ask:',
    options: [
      { value: 'fast', label: '“What needs to be done?” or “When can we do it?”' },
      { value: 'slow', label: '“Who’s involved?” or “How should we do it?” or “Why does it matter?”' },
    ],
  },
];

const styles = {
    Driver: { 
        title: 'Driver (Direct)', 
        focus: 'Task / Faster', 
        traits: 'Goal-driven, confident, achievement-focused', 
        questions: 'What & When', 
        color: 'bg-blue-700',
        advice: 'Be direct, focus on results, and be prepared with facts. Avoid small talk and present clear, actionable solutions.'
    },
    Expressive: { 
        title: 'Expressive', 
        focus: 'People / Faster', 
        traits: 'Ego-driven, visionary, recognition-seeking', 
        questions: 'Who & What', 
        color: 'bg-green-600',
        advice: 'Show enthusiasm, recognize their ideas, and focus on the big picture. Provide testimonials and paint a picture of success.'
    },
    Amiable: { 
        title: 'Amiable', 
        focus: 'People / Slower', 
        traits: 'Supportive, harmony-seeking, loyal', 
        questions: 'Who & How', 
        color: 'bg-red-600',
        advice: 'Build rapport, offer personal assurances, and provide a secure, low-risk plan. Be patient and build trust over time.'
    },
    Analytical: { 
        title: 'Analytical', 
        focus: 'Task / Slower', 
        traits: 'Accurate, detail-oriented, reserved', 
        questions: 'How & Why', 
        color: 'bg-yellow-500',
        advice: 'Be prepared with data, facts, and a logical process. Provide detailed information and give them time to think. Avoid pressure.'
    }
};

interface DiagnosticQuizProps {
    onAnalysisComplete: (result: ResultStyle | null) => void;
}

export default function DiagnosticQuiz({ onAnalysisComplete }: DiagnosticQuizProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultStyle | null>(null);
  const { control } = useForm();

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setResult(null); // Reset result when an answer changes
    onAnalysisComplete(null);
  };

  const handleTally = () => {
    const fastCount = Object.values(answers).filter(v => v === 'fast').length;
    const slowCount = Object.values(answers).filter(v => v === 'slow').length;

    const q1Answer = answers.q1;
    const q6Answer = answers.q6;

    let finalResult: ResultStyle | null = null;

    if (fastCount >= 4) { // Predominantly faster pace
      if (q1Answer === 'fast' && q6Answer === 'fast') finalResult = 'Driver';
      else if (q1Answer === 'slow' && q6Answer === 'slow') finalResult = 'Expressive';
      else finalResult = 'Expressive'; // Default to Expressive if mixed focus
    } else if (slowCount >= 4) { // Predominantly slower pace
      if (q1Answer === 'slow' && q6Answer === 'slow') finalResult = 'Amiable';
      else if (q1Answer === 'fast' && q6Answer === 'fast') finalResult = 'Analytical';
      else finalResult = 'Analytical'; // Default to Analytical if mixed focus
    } else { // Mixed pace, decide on focus
      const taskFocus = (q1Answer === 'fast' ? 1 : 0) + (q6Answer === 'fast' ? 1 : 0);
      const peopleFocus = (q1Answer === 'slow' ? 1 : 0) + (q6Answer === 'slow' ? 1 : 0);
      if (taskFocus > peopleFocus) finalResult = (fastCount > slowCount ? 'Driver' : 'Analytical');
      else finalResult = (fastCount > slowCount ? 'Expressive' : 'Amiable');
    }
    setResult(finalResult);
    onAnalysisComplete(finalResult);
  };
  
  const allAnswered = Object.keys(answers).length === questions.length;

  return (
    <div className="p-4 my-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Customer Behaviour & Communication Style Diagnostic</h3>
        <p className="text-sm text-muted-foreground mb-4">
            Answer the following 6 questions about your customer or prospect. Choose the option that best reflects their natural behaviour at work to help you tailor your communication style.
        </p>
        <div className="space-y-6">
            {questions.map((q) => (
                <div key={q.id}>
                    <Label className="font-medium">{q.question}</Label>
                    <Controller
                        name={q.id}
                        control={control}
                        render={({ field }) => (
                            <RadioGroup
                                value={answers[q.id] || ''}
                                onValueChange={(value) => handleAnswerChange(q.id, value)}
                                className="mt-2 space-y-2"
                            >
                                {q.options.map(opt => (
                                <div key={opt.value} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                                    <Label htmlFor={`${q.id}-${opt.value}`} className="font-normal">{opt.label}</Label>
                                </div>
                                ))}
                            </RadioGroup>
                        )}
                    />
                </div>
            ))}
        </div>

        <Button onClick={handleTally} disabled={!allAnswered} className="mt-6">
            <BarChart2 className="mr-2 h-4 w-4" /> Analyse Style
        </Button>

        {result && (
            <Card className={cn("mt-6 border-l-4", styles[result].color.replace('bg-','border-'))}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <span className={cn("px-4 py-2 text-white rounded-md", styles[result].color)}>
                            Customer Style: {styles[result].title}
                        </span>
                    </CardTitle>
                    <CardDescription>{styles[result].focus}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="font-semibold text-foreground">Key Traits:</p>
                    <p className="text-muted-foreground mb-2">{styles[result].traits}</p>
                    <p className="font-semibold text-foreground">Typical Questions:</p>
                    <p className="text-muted-foreground mb-4">{styles[result].questions}</p>
                    <p className="font-semibold text-foreground">How to Engage:</p>
                    <p className="text-muted-foreground">{styles[result].advice}</p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
