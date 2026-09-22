"use client";

import React, { useMemo, useState } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Search, Loader2, Clock, History } from 'lucide-react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AuditEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AuditLogPageContent() {
  const { actualRole } = useAuth();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || actualRole !== 'superadmin') return null;
    return query(collection(firestore, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500));
  }, [firestore, actualRole]);

  const { data: logs, isLoading } = useCollection<AuditEntry>(logsQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
        const q = searchQuery.toLowerCase();
        return (
            log.action.toLowerCase().includes(q) ||
            log.userEmail.toLowerCase().includes(q) ||
            log.companyId.toLowerCase().includes(q) ||
            JSON.stringify(log.metadata || {}).toLowerCase().includes(q)
        );
    });
  }, [logs, searchQuery]);

  if (actualRole !== 'superadmin') return <div className="p-20 text-center">Unauthorized. Superadmin only.</div>;

  const getActionBadge = (action: string) => {
      const styles: any = {
          'USER_CREATE': 'bg-green-100 text-green-700 border-green-200',
          'USER_DELETE': 'bg-red-100 text-red-700 border-red-200',
          'ROLE_UPDATE': 'bg-blue-100 text-blue-700 border-blue-200',
          'COMPANY_UPDATE': 'bg-purple-100 text-purple-700 border-purple-200',
          'RATE_FILE_UPDATE': 'bg-amber-100 text-amber-700 border-amber-200',
          'SETTINGS_UPDATE': 'bg-indigo-100 text-indigo-700 border-indigo-200',
          'SECURITY_BYPASS_ATTEMPT': 'bg-destructive/10 text-destructive border-destructive/20',
      };
      return <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", styles[action] || 'bg-muted')}>{action.replace(/_/g, ' ')}</Badge>;
  }

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <ShieldCheck className="mr-2 h-7 w-7 text-primary" /> System Audit Trail
              </CardTitle>
              <CardDescription>Monitor administrative actions and security events across the entire platform.</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search trail..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="h-[700px] w-full">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {format(parseISO(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs font-semibold">{log.userEmail}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[9px] h-4 font-mono">{log.companyId}</Badge></TableCell>
                      <TableCell>
                        <div className="max-w-[200px] overflow-hidden">
                            <pre className="text-[9px] font-mono bg-muted p-1 rounded truncate">
                                {JSON.stringify(log.metadata || {}, null, 1)}
                            </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No audit records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
