
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, History, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface GuruHistoryProps {
  history: any[];
  onLoad: (entry: any) => void;
  onDelete: (index: number) => void;
  onStartNew: () => void;
  isLoading: boolean;
}

export default function GuruHistory({ history, onLoad, onDelete, onStartNew, isLoading }: GuruHistoryProps) {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>AI "Perfect Plan" Assistant</CardTitle>
        <CardDescription>
          Generate optimized freight solutions and spend band analysis for new business opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onStartNew} size="lg" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5" />} Start New Perfect Plan
        </Button>
        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 text-left">
              Recent Plans:
            </h3>
            <div className="flex flex-col gap-2">
              {history.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md hover:bg-muted transition-colors group">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-grow justify-start h-auto p-0 hover:bg-transparent"
                    onClick={() => onLoad(entry)}
                  >
                    <History className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                        <p className="text-sm font-semibold">{entry.customerName || 'Unnamed Customer'}</p>
                        <p className="text-[10px] text-muted-foreground">
                            {entry.date ? format(new Date(entry.date), 'dd/MM/yy HH:mm') : 'Unknown date'}
                        </p>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Loader2 } from 'lucide-react';
