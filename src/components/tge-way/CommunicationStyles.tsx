
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { UserCheck, Zap, Bot, Heart, Glasses, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type ResultStyle = 'Driver' | 'Expressive' | 'Amiable' | 'Analytical';

interface StyleInfo {
  title: ResultStyle;
  icon: React.ReactNode;
  focus: string;
  borderColor: string;
  backgroundColor: string;
  questions: string;
  behaviors: string[];
}

const stylesInfo: Record<ResultStyle, StyleInfo> = {
    Driver: { 
        title: 'Driver', 
        icon: <Zap className="h-6 w-6" />,
        focus: 'Task-Focused | Faster-Paced', 
        borderColor: 'border-blue-600',
        backgroundColor: 'bg-blue-50 dark:bg-blue-900/20',
        questions: 'What & When', 
        behaviors: ['Decisive & Action-Oriented', 'Likes control, takes charge', 'Goal-driven and direct', 'Focuses on results']
    },
    Expressive: { 
        title: 'Expressive', 
        icon: <Sparkles className="h-6 w-6" />,
        focus: 'People-Focused | Faster-Paced', 
        borderColor: 'border-green-600',
        backgroundColor: 'bg-green-50 dark:bg-green-900/20',
        questions: 'Who & What', 
        behaviors: ['Enthusiastic and creative', 'Focuses on the big picture', 'Seeks recognition and involvement', 'Spontaneous and sociable']
    },
    Amiable: { 
        title: 'Amiable', 
        icon: <Heart className="h-6 w-6" />,
        focus: 'People-Focused | Slower-Paced', 
        borderColor: 'border-red-600',
        backgroundColor: 'bg-red-50 dark:bg-red-900/20',
        questions: 'Who & How', 
        behaviors: ['Supportive and agreeable', 'Avoids conflict, seeks harmony', 'Patient and loyal listener', 'Values personal relationships']
    },
    Analytical: { 
        title: 'Analytical', 
        icon: <Glasses className="h-6 w-6" />,
        focus: 'Task-Focused | Slower-Paced', 
        borderColor: 'border-yellow-500',
        backgroundColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        questions: 'How & Why', 
        behaviors: ['Systematic and logical', 'Data-driven and cautious', 'Prefers accuracy and detail', 'Can be reserved and procedural']
    }
};


const StyleCard = ({ style, customerStyle }: { style: StyleInfo, customerStyle: ResultStyle | null }) => {
    const isCustomerStyle = customerStyle === style.title;
    return (
        <Card className={cn("flex flex-col h-full border-2", style.borderColor, style.backgroundColor, isCustomerStyle && 'ring-4 ring-offset-2 ring-accent')}>
            {isCustomerStyle && (
                <div className="absolute -top-3 -right-3 bg-accent text-accent-foreground rounded-full p-2 z-10 shadow-lg">
                    <UserCheck className="h-5 w-5" />
                </div>
            )}
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3 text-foreground">
                    {style.icon}
                    <CardTitle>{style.title}</CardTitle>
                </div>
                <CardDescription className="font-semibold">{style.focus}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
                <div className="mb-3">
                    <h4 className="font-semibold text-sm">Behaviours Seen:</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                        {style.behaviors.map(b => <li key={b}>{b}</li>)}
                    </ul>
                </div>
                <Badge variant="outline" className="self-start">Asks: "{style.questions}"</Badge>
            </CardContent>
        </Card>
    );
}

export default function CommunicationStyles({ customerStyle }: { customerStyle: ResultStyle | null }) {
  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Summary of Business Behaviours & Communication Styles</h3>
       <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Horizontal Axis */}
            <div className="hidden md:flex absolute top-1/2 left-0 w-full h-px bg-gray-400 -translate-y-1/2 z-0 items-center justify-between px-8">
                <span className="bg-background px-2 text-sm font-medium">Faster-Paced</span>
                <span className="bg-background px-2 text-sm font-medium">Slower-Paced</span>
            </div>
             {/* Vertical Axis */}
            <div className="hidden md:flex absolute left-1/2 top-0 h-full w-px bg-gray-400 -translate-x-1/2 z-0 items-center justify-between py-8">
                <span className="bg-background px-2 text-sm font-medium -rotate-90">People-Focused</span>
                <span className="bg-background px-2 text-sm font-medium -rotate-90">Task-Focused</span>
            </div>

            <div className="z-10"><StyleCard style={stylesInfo.Expressive} customerStyle={customerStyle} /></div>
            <div className="z-10"><StyleCard style={stylesInfo.Amiable} customerStyle={customerStyle} /></div>
            <div className="z-10"><StyleCard style={stylesInfo.Driver} customerStyle={customerStyle} /></div>
            <div className="z-10"><StyleCard style={stylesInfo.Analytical} customerStyle={customerStyle} /></div>
       </div>
    </div>
  );
}
