"use client";

import React from 'react';
import { format } from 'date-fns';
import { 
  Lightbulb, 
  ShieldAlert, 
  Sparkles, 
  ChevronRight,
  User,
  Package,
  ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: 'lead' | 'problem' | 'quote';
  title: string;
  subtitle: string;
  timestamp: any;
  status?: string;
  user?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading: boolean;
}

const ActivityIcon = ({ type }: { type: ActivityItem['type'] }) => {
  switch (type) {
    case 'lead': return <Lightbulb className="h-4 w-4 text-blue-500" />;
    case 'problem': return <ShieldAlert className="h-4 w-4 text-destructive" />;
    case 'quote': return <Sparkles className="h-4 w-4 text-accent" />;
  }
};

export default function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <Card className="h-full flex flex-col shadow-lg border-none bg-muted/20">
      <CardHeader className="pb-3 border-b bg-card rounded-t-lg">
        <CardTitle className="text-xl font-bold font-headline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-primary" />
            Activity
          </div>
          {items.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 font-bold">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 bg-muted rounded"></div>
                    <div className="h-2 w-3/4 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="divide-y divide-border/50">
              {items.map((item) => (
                <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors group relative">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-background rounded-full shadow-sm border border-border/50 group-hover:border-primary/30 transition-colors">
                      <ActivityIcon type={item.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-sm font-bold truncate pr-4">{item.title.replace('>', '&gt;')}</h4>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                          {item.timestamp ? format(new Date(item.timestamp), 'HH:mm') : '--:--'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.subtitle.replace('>', '&gt;')}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1.5 font-bold">
                          {item.type}
                        </Badge>
                        {item.user && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                            <User className="h-2.5 w-2.5" /> {item.user.split('@')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </div>
                  <Link href={item.type === 'quote' ? '/calculator' : '/problem-log'} className="absolute inset-0">
                    <span className="sr-only">View Details</span>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground italic flex flex-col items-center gap-3">
              <Package className="h-12 w-12 opacity-10" />
              <p className="text-xs">No activity recorded today.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
