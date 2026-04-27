
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Target, Search, Handshake, Lightbulb, ShieldQuestion, Award, Send, Printer } from 'lucide-react';
import WhiteSpaceAnalysis from '@/components/tge-way/WhiteSpaceAnalysis';
import CustomerNeedsAnalysis from '@/components/tge-way/CustomerNeedsAnalysis';
import BuildingRelationships from '@/components/tge-way/BuildingRelationships';
import PreCallPlanner from '@/components/tge-way/PreCallPlanner';
import CommunicationStyles, { type ResultStyle } from '@/components/tge-way/CommunicationStyles';
import PeopleReadingExercise from '@/components/tge-way/PeopleReadingExercise';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import EngagePlanner from '@/components/tge-way/EngagePlanner';
import DiagnosticQuiz from '@/components/tge-way/DiagnosticQuiz';


const salesProcessSteps = [
  {
    icon: <Search className="h-6 w-6 text-primary" />,
    title: "PREPARE",
    subtitle: "Understand Our Business",
    content: "Thoroughly research the customer's industry, business needs, and shipping patterns. Understand TGE's capabilities and how they align with the customer's requirements to prepare a tailored approach.",
    components: [<BuildingRelationships key="relationships" />, <WhiteSpaceAnalysis key="whitespace" />, <CustomerNeedsAnalysis key="needs" />, <PreCallPlanner key="planner" />]
  },
  {
    icon: <Target className="h-6 w-6 text-primary" />,
    title: "OPPORTUNITY",
    subtitle: "Identify Potential",
    content: "Identify and qualify potential leads. Analyze freight data and shipping lanes to pinpoint specific areas where TGE can provide value and create a compelling business case.\n\nKey activities include:\n• People Reading (Behaviours)\n• Meeting Set Up (WWHOA)\n• Positioning TGE to New Customers/Contacts\n• Demonstrating Genuine Interest\n• Building Trust and Rapport\n• Understanding the Customer's Personal Motivators",
    components: ["diagnostic-quiz", "communication-styles", <PeopleReadingExercise key="people-reading" />]
  },
  {
    icon: <Handshake className="h-6 w-6 text-primary" />,
    title: "ENGAGE",
    subtitle: "Apply Your Knowledge",
    content: `Initiate contact and build rapport with the potential customer. Use your knowledge of their business and our services to have meaningful conversations that uncover their pain points and goals.

Summary:
By feeding back key points from our discussion, summarising demonstrates to the client that we have a Genuine Interest in them and the conversation.
1. It offers the client the chance to either add to any relevant points or amend if we might have misunderstood what they have told us.
2. At the end of summarising, you will have mutual understanding and have gained agreement that you have the full picture of the client's situation.

We then get commitment to move to the next stage of the conversation.

Why Summarise?
The process is a cycle: Ask Questions → Listen Actively → Summarise`,
    components: [<EngagePlanner key="engage-planner" />]
  },
  {
    icon: <Lightbulb className="h-6 w-6 text-primary" />,
    title: "PROVIDE SOLUTIONS",
    subtitle: "Tailor the Offer",
    content: "Present a customized solution that directly addresses the customer's needs. Use the tools available to demonstrate clear value, cost savings, and service improvements.",
    components: []
  },
  {
    icon: <ShieldQuestion className="h-6 w-6 text-primary" />,
    title: "MANAGE OBJECTIONS",
    subtitle: "Understand Your Customer",
    content: "Listen to and address any concerns or objections the customer may have. Use your understanding of their business and our value proposition to provide clear, confident, and reassuring answers.",
    components: []
  },
  {
    icon: <Award className="h-6 w-6 text-primary" />,
    title: "CLOSE",
    subtitle: "Secure the Business",
    content: "Move the opportunity towards a decision. Summarize the value proposition, finalize the agreement, and formally welcome the new customer to Team Global Express.",
    components: []
  },
  {
    icon: <Send className="h-6 w-6 text-primary" />,
    title: "FOLLOW UP",
    subtitle: "Ensure Success",
    content: "After closing the deal, follow up to ensure a smooth onboarding process and initial shipment experience. This builds a strong foundation for a long-term partnership.",
    components: []
  }
];

export default function TGEWayPageContent() {
  const [customerName, setCustomerName] = useState('');
  const [quizResult, setQuizResult] = useState<ResultStyle | null>(null);


  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print-expand">
      <Card className="shadow-xl print-hide">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl font-headline flex items-center">
                    The TGE Way
                </CardTitle>
                <CardDescription>
                    The core principles and process for successful business development at Team Global Express.
                </CardDescription>
            </div>
            <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Print / Export to PDF
            </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">

           <div className="mb-6">
                <Label htmlFor="customer-name" className="text-base font-semibold flex items-center mb-2">
                    <User className="mr-2 h-5 w-5 text-primary" />
                    Customer / Prospect Name
                </Label>
                <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter the customer or prospect's name..."
                    className="max-w-md"
                />
            </div>

          <Accordion type="multiple" defaultValue={['PREPARE', 'OPPORTUNITY']} className="w-full">
            {salesProcessSteps.map(step => (
              <AccordionItem key={step.title} value={step.title}>
                <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                  <div className="flex items-center gap-4">
                    {step.icon}
                    <div>
                      <div>{step.title}</div>
                      <p className="text-sm font-normal text-muted-foreground">{step.subtitle}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-base pl-14 space-y-4">
                  <p className="whitespace-pre-line">{step.content}</p>
                  {step.components.map((Component, index) => {
                    if (typeof Component === 'string') {
                      if (Component === 'diagnostic-quiz') {
                        return <DiagnosticQuiz key="diagnostic-quiz" onAnalysisComplete={setQuizResult} />;
                      }
                      if (Component === 'communication-styles') {
                        return <CommunicationStyles key="communication-styles" customerStyle={quizResult} />;
                      }
                    }
                    return <React.Fragment key={index}>{Component}</React.Fragment>;
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
