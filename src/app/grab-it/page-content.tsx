"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GrabItPageContent() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Target className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-headline">Tool Disabled</CardTitle>
          <CardDescription>
            The "Grab It" lead capture tool has been removed from the current site configuration to optimize performance and data reliability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please use the manual Activity Log for tracking service issues, or the Find It tool for navigation.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
