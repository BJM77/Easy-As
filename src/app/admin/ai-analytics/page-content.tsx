
"use client";

import React, { useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { 
  BrainCircuit, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Loader2, 
  ArrowUpRight, 
  LayoutDashboard,
  ShieldCheck,
  History
} from 'lucide-react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format, parseISO, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#673AB7', '#3F51B5', '#00BCD4', '#009688', '#4CAF50', '#FFC107'];

export default function AiAnalyticsPageContent() {
  const { actualRole } = useAuth();
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || actualRole !== 'superadmin') return null;
    return query(collection(firestore, 'ai_usage_log'), orderBy('timestamp', 'desc'), limit(1000));
  }, [firestore, actualRole]);

  const { data: logs, isLoading } = useCollection(logsQuery);

  const stats = useMemo(() => {
    if (!logs) return null;

    const dailyUsageMap: Record<string, { tokens: number; cost: number }> = {};
    const companyUsageMap: Record<string, { tokens: number; calls: number }> = {};
    const userUsageMap: Record<string, { email: string; tokens: number; calls: number }> = {};

    let totalTokens = 0;
    let totalCost = 0;

    logs.forEach(log => {
      totalTokens += log.totalTokens;
      totalCost += log.cost;

      // Group by Day
      const day = format(parseISO(log.timestamp), 'yyyy-MM-dd');
      if (!dailyUsageMap[day]) dailyUsageMap[day] = { tokens: 0, cost: 0 };
      dailyUsageMap[day].tokens += log.totalTokens;
      dailyUsageMap[day].cost += log.cost;

      // Group by Company
      const company = log.companyId || 'Global/System';
      if (!companyUsageMap[company]) companyUsageMap[company] = { tokens: 0, calls: 0 };
      companyUsageMap[company].tokens += log.totalTokens;
      companyUsageMap[company].calls += 1;

      // Group by User
      const userId = log.userId || 'system';
      if (!userUsageMap[userId]) userUsageMap[userId] = { email: log.userEmail || 'System', tokens: 0, calls: 0 };
      userUsageMap[userId].tokens += log.totalTokens;
      userUsageMap[userId].calls += 1;
    });

    const dailyData = Object.entries(dailyUsageMap)
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const companyData = Object.entries(companyUsageMap)
      .map(([name, val]) => ({ name, value: val.tokens }))
      .sort((a, b) => b.value - a.value);

    const userData = Object.entries(userUsageMap)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => b.tokens - a.tokens);

    return { totalTokens, totalCost, dailyData, companyData, userData, avgCost: totalCost / (logs.length || 1) };
  }, [logs]);

  if (actualRole !== 'superadmin') {
    return <div className="p-8 text-center">Unauthorized. Superadmin access only.</div>;
  }

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Aggregating Global AI Usage Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <BrainCircuit className="mr-2 h-7 w-7 text-primary" /> AI Token Analytics
              </CardTitle>
              <CardDescription>Global monitoring of model consumption and enterprise API costs.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary">Live Pulse</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> +12% from last week
            </p>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Based on Gemini 2.0 Flash pricing</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Avg. Cost / Call</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgCost.toFixed(4)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Highly cost-efficient throughput</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.companyData.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Spanning multiple organizations</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Token Consumption Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyData}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#673AB7" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#673AB7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="tokens" stroke="#673AB7" fillOpacity={1} fill="url(#colorTokens)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Share by Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.companyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.companyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> High-Activity User Audit
          </CardTitle>
          <CardDescription>Monitor individual throughput to prevent API abuse or identify power users.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User / Identifier</TableHead>
                <TableHead className="text-right">Total Calls</TableHead>
                <TableHead className="text-right">Tokens Consumed</TableHead>
                <TableHead className="text-right">Est. Billable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.userData.slice(0, 10).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-right font-mono">{user.calls}</TableCell>
                  <TableCell className="text-right font-mono text-primary font-bold">{user.tokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">
                    <Badge variant="outline" className="font-mono text-[10px]">${((user.tokens / 1000000) * 0.5).toFixed(4)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
