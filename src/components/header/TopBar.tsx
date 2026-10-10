"use client";

import React from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/firebase';
import { useSettings } from "@/context/SettingsContext";
import { availableIcons } from '@/components/HeaderConfigDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export function TopBar() {
  const { sessionTokens } = useSession();
  const { profile, company, nextAlarm } = useAuth();
  const { timezones, visibleTimezones, externalLinks } = useSettings();
  const availableTokens = profile?.tokens ?? 0;

  const activeTimezones = Object.entries(timezones).filter(([zoneId]) => visibleTimezones[zoneId]);

  return (
    <div
      className="w-full py-1.5 px-4 border-b transition-colors"
      style={{ backgroundColor: company?.settings?.topMenuColor || 'hsl(var(--background))' }}
    >
      <div
        className={cn(
          "container mx-auto flex items-center text-xs",
          nextAlarm ? 'flex-col md:row md:justify-between' : 'justify-between'
        )}
      >
        <div className="hidden md:flex items-center gap-4 w-full justify-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 rounded-full', 'bg-green-500')}></div>
                <span className="text-muted-foreground font-mono">
                  {availableTokens.toLocaleString()}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Available AI Tokens</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1">
            <TooltipProvider>
              {externalLinks.map((link) => {
                const Icon = availableIcons[link.icon as keyof typeof availableIcons] || Link2;
                return (
                  <Tooltip key={link.id}>
                    <TooltipTrigger asChild>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center rounded-md p-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="sr-only">{link.label}</span>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{link.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>

        <div className="md:hidden w-full flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs px-2 h-auto text-muted-foreground">
                Info & Links
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <ScrollArea className="h-[40vh]">
                <DropdownMenuLabel>AI Tokens</DropdownMenuLabel>
                <DropdownMenuItem disabled>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground font-mono text-xs">
                      {availableTokens.toLocaleString()}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>External Links</DropdownMenuLabel>
                {externalLinks.map((link) => {
                  const Icon = availableIcons[link.icon as keyof typeof availableIcons] || Link2;
                  return (
                    <DropdownMenuItem key={`mobile-${link.id}`} asChild>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{link.label}</span>
                      </a>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Timezones</DropdownMenuLabel>
                {activeTimezones.map(([zoneId, { label, time }]) => (
                  <DropdownMenuItem key={`mobile-tz-${zoneId}`} disabled>
                    {label}: {time}
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden md:flex items-center gap-2 font-mono text-muted-foreground ml-auto">
          {activeTimezones.map(([zoneId, { label, time }]) => (
            <span key={zoneId}>
              {label}: {time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TopBar;
