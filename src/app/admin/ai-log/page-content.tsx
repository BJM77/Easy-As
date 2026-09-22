
"use client";

import React, { useState, useMemo } from 'react';
import type { AiUsageEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { BarChart, BrainCircuit, Calendar, FileJson, Hash, TrendingUp, Info } from 'lucide-react';

interface AiLogPageContentProps {
  initialLogs: AiUsageEntry[];
}

const formatCurrency = (amount: number | null, decimals = 6) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatNumber = (num: number | null) => {
  if (num === null || isNaN(num)) return "N/A";
  return num.toLocaleString('en-AU');
}

export default function AiLogPageContent({ initialLogs }: AiLogPageContentProps) {
  const [logs, setLogs] = useState(initialLogs);

  const summaryStats = useMemo(() => {
    const totalEntries = logs.length;
    const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
    const averageTokensPerCall = totalEntries > 0 ? totalTokens / totalEntries : 0;

    return { totalEntries, totalTokens, totalCost, averageTokensPerCall };
  }, [logs]);

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BrainCircuit className="mr-2 h-7 w-7 text-primary" /> AI Usage & Cost Log
          </CardTitle>
          <CardDescription>
            A persistent log of all AI service calls made by the application, showing token usage and estimated costs.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatNumber(summaryStats.totalEntries)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens Used</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatNumber(summaryStats.totalTokens)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Tokens per Call</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatNumber(Math.round(summaryStats.averageTokensPerCall))}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Total Cost</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(summaryStats.totalCost)}</div><p className="text-xs text-muted-foreground">Based on an estimated cost.</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>Most recent AI calls are shown first.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Service/Flow</TableHead>
                  <TableHead className="text-right">Total Tokens</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Estimated Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}</TableCell>
                      <TableCell className="font-medium">{log.serviceName}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatNumber(log.totalTokens)}</TableCell>
                      <TableCell className="text-right">{formatNumber(log.inputTokens)}</TableCell>
                      <TableCell className="text-right">{formatNumber(log.outputTokens)}</TableCell>
                      <TableCell className="text-right text-xs">{formatCurrency(log.cost)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No AI usage has been logged yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
