import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'FreightAssist.Online | Secure Freight Intelligence',
  description: 'Enterprise multi-modal freight intelligence and calculation platform.',
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-background">
        <div className="flex items-center justify-center">
          <span className="font-bold font-headline text-lg text-primary tracking-tight">FreightAssist</span>
          <span className="font-light text-muted-foreground ml-1">Online</span>
        </div>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            Login
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/register">
            Register
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-muted/30">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2 max-w-3xl">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Smart Freight Intelligence for Modern Logistics
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Quote freight, build rate cards, and manage accounts in minutes. An independent tool built to streamline your workflow.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/register">
                  <Button className="h-11 px-8">Start Free Trial</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="h-11 px-8">Sign In</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          © 2026 FreightAssist.Online. All rights reserved. This is an independent tool.
        </p>
      </footer>
    </div>
  );
}
