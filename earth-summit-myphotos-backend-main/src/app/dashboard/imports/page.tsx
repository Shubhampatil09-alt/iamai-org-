'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ImportJobStatus from '@/components/ImportJobStatus';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

type ImportJob = {
  id: string;
  folderName: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  successFiles: number;
  failedFiles: number;
  createdAt: string;
  room: {
    id: string;
    name: string;
  };
};

function ImportsPageContent() {
  const searchParams = useSearchParams();
  const highlightJobId = searchParams.get('jobId');

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();

    // Auto-refresh every 10 seconds if there are active jobs
    const interval = setInterval(() => {
      loadJobs();
    }, 10000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/gdrive/import');
      const data = await response.json();

      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Import Jobs</h1>
          <p className="text-gray-600 mt-1">
            Track your Google Drive imports. Jobs run in the background - you can safely close this page.
          </p>
        </div>
        <Button onClick={loadJobs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500">No import jobs yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`transition-all ${
                highlightJobId === job.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <ImportJobStatus jobId={job.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <ImportsPageContent />
    </Suspense>
  );
}
