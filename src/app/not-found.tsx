
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileQuestion, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <FileQuestion className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">404</CardTitle>
          <CardHeader className="text-xl p-0">Page Not Found</CardHeader>
          <CardDescription className="pt-2">
            The page you are looking for doesn't exist or has been moved to a new location.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-2">
          <p className="text-sm text-muted-foreground">
            Try checking the URL for typos or use the navigation menu to find what you're looking for.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6">
          <Button asChild className="w-full sm:w-auto flex-1">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto flex-1">
            <Link href="/location-lookup">
              <Search className="mr-2 h-4 w-4" /> Search Tools
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
