
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Award, HelpCircle } from 'lucide-react';
import Confetti from 'react-confetti';
import { cn } from '@/lib/utils';

const quizQuestions = [
  {
    question: "Which surcharge is NOT typically applied to a standard B2B Priority service?",
    options: ["Fuel Surcharge", "Security Surcharge", "Hand Unload Fee"],
    answer: "Hand Unload Fee"
  },
  {
    question: "What is the primary zone system used for B2B Priority and B2C services?",
    options: ["IPEC", "PRIO", "PE", "RDEX"],
    answer: "PRIO"
  },
  {
    question: "A 'Manual Handling Fee' is applied to a B2B Priority item if its dead weight is over:",
    options: ["25kg", "30kg", "50kg"],
    answer: "30kg"
  },
  {
    question: "If a B2B Priority consignment has an 'After Hours Delivery' request, what type of surcharge is applied?",
    options: ["Percentage", "Fixed per kg", "Fixed per shipment"],
    answer: "Fixed per shipment"
  },
  {
    question: "What is the cubic conversion factor for all Priority network services?",
    options: ["167", "250", "333"],
    answer: "250"
  },
  {
    question: "If an oversize item surcharge and a manual handling surcharge both apply to a B2B Priority item, what happens?",
    options: ["Both are applied", "Only the higher of the two is applied", "Neither is applied"],
    answer: "Only the higher of the two is applied"
  },
  {
    question: "The B2C service has a dimensional limit based on the sum of Length + Width + Height. What is this limit?",
    options: ["100cm", "120cm", "180cm"],
    answer: "120cm"
  },
  {
    question: "A Public Holiday Service Fee for a B2B Priority shipment is what type of charge?",
    options: ["Percentage of base freight", "Fixed per shipment", "Fixed per kilogram"],
    answer: "Fixed per shipment"
  },
];

const quizSchema = z.object(
  quizQuestions.reduce((acc, q, i) => {
    acc[`question_${i}`] = z.string({
      required_error: "Please select an answer.",
    });
    return acc;
  }, {} as Record<string, z.ZodString>)
);

type QuizFormValues = z.infer<typeof quizSchema>;

export default function PriorityQuizPageContent() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizSchema),
  });

  const { control, handleSubmit, watch, formState } = form;
  const watchedAnswers = watch();

  const onSubmit = (data: QuizFormValues) => {
    let newScore = 0;
    quizQuestions.forEach((q, i) => {
      if (data[`question_${i}` as keyof QuizFormValues] === q.answer) {
        newScore++;
      }
    });
    setScore(newScore);
    setIsSubmitted(true);
  };

  const handleReset = () => {
    form.reset();
    setIsSubmitted(false);
    setScore(0);
  };

  const getOptionClasses = (questionIndex: number, option: string) => {
    if (!isSubmitted) return '';
    const questionKey = `question_${questionIndex}` as keyof QuizFormValues;
    const isCorrectAnswer = option === quizQuestions[questionIndex].answer;
    const isSelectedAnswer = watchedAnswers[questionKey] === option;

    if (isCorrectAnswer) return 'bg-green-100 dark:bg-green-900/30 border-green-500';
    if (isSelectedAnswer && !isCorrectAnswer) return 'bg-red-100 dark:bg-red-900/30 border-red-500';
    return '';
  };
  
  const getIcon = (questionIndex: number, option: string) => {
      if (!isSubmitted) return null;
      const questionKey = `question_${questionIndex}` as keyof QuizFormValues;
      const isCorrectAnswer = option === quizQuestions[questionIndex].answer;
      const isSelectedAnswer = watchedAnswers[questionKey] === option;

      if (isCorrectAnswer) return <CheckCircle className="h-5 w-5 text-green-600" />;
      if (isSelectedAnswer && !isCorrectAnswer) return <XCircle className="h-5 w-5 text-red-600" />;
      return null;
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center">
          <Award className="mr-2 h-7 w-7 text-primary" /> Priority Network Quiz
        </CardTitle>
        <CardDescription>
          Test your knowledge on the Priority services, including B2B, B2C, and LCP.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSubmitted && (
          <div className="text-center py-8">
            {score / quizQuestions.length >= 0.8 && <Confetti width={1000} height={1000} />}
            <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-xl text-muted-foreground mb-4">Your Score:</p>
            <p className={`text-6xl font-bold mb-6 ${score / quizQuestions.length >= 0.8 ? 'text-green-600' : 'text-destructive'}`}>
              {score} / {quizQuestions.length}
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {quizQuestions.map((q, index) => (
            <div key={`q-${index}`}>
              <Label className="font-semibold text-base">{q.question}</Label>
              <Controller
                name={`question_${index}` as any}
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="mt-2 space-y-2"
                    disabled={isSubmitted}
                  >
                    {q.options.map(opt => (
                      <div
                        key={opt}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-md border transition-all",
                          isSubmitted ? getOptionClasses(index, opt) : "border-input"
                        )}
                      >
                        <RadioGroupItem value={opt} id={`q-${index}-opt-${opt}`} />
                        <Label htmlFor={`q-${index}-opt-${opt}`} className="font-normal flex-grow cursor-pointer">{opt}</Label>
                        {isSubmitted && getIcon(index, opt)}
                      </div>
                    ))}
                  </RadioGroup>
                )}
              />
              {formState.errors[`question_${index}` as keyof QuizFormValues] && !isSubmitted && (
                <p className="text-sm text-destructive mt-2">{formState.errors[`question_${index}` as keyof QuizFormValues]?.message}</p>
              )}
              {index < quizQuestions.length - 1 && <Separator className="mt-8" />}
            </div>
          ))}
          {!isSubmitted ? (
            <Button type="submit" size="lg" className="w-full">Submit Answers</Button>
          ) : (
             <Button onClick={handleReset} size="lg" variant="outline" className="w-full">Try Again</Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
