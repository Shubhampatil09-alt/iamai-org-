import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ModernSearchInterface from '@/components/ModernSearchInterface';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function SearchPage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Search Similar Photos
            </h1>
            <p className="text-muted-foreground mt-1">
              Find visually similar images using AI-powered search
            </p>
          </div>
          <Link href="/">
            <Button size="lg" variant="outline" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back to Gallery
            </Button>
          </Link>
        </div>

        {/* Search Interface */}
        <ModernSearchInterface />
      </div>
    </main>
  );
}
