'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Clock, Ban } from 'lucide-react';

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
    name: string;
  };
};

type Props = {
  jobId: string;
  onComplete?: () => void;
};

export default function ImportJobStatus({ jobId, onComplete }: Props) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadJob();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      loadJob();
    }, 10000);

    return () => clearInterval(interval);
  }, [jobId]); // Only re-run if jobId changes

  const loadJob = async () => {
    try {
      const response = await fetch(`/api/gdrive/import?jobId=${jobId}`);
      const data = await response.json();

      if (data.job) {
        setJob(data.job);

        if ((data.job.status === 'COMPLETED' || data.job.status === 'FAILED' || data.job.status === 'CANCELLED') && onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this import and delete all uploaded photos? This cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch('/api/gdrive/import/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (response.ok) {
        await loadJob(); // Refresh to show CANCELLED status
      } else {
        const data = await response.json();
        alert(`Failed to cancel: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert('Failed to cancel job. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const progress = job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{job.folderName}</h3>
          <p className="text-sm text-gray-500">Room: {job.room.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {(job.status === 'PROCESSING' || job.status === 'QUEUED' || job.status === 'DISCOVERING') && (
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              variant="destructive"
              size="sm"
            >
              <Ban className="h-4 w-4 mr-1" />
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{job.processedFiles} / {job.totalFiles}</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{job.totalFiles}</div>
          <div className="text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{job.successFiles}</div>
          <div className="text-gray-500">Success</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{job.failedFiles}</div>
          <div className="text-gray-500">Failed</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Pending' },
    DISCOVERING: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Discovering' },
    QUEUED: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Queued' },
    PROCESSING: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' },
    COMPLETED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
    FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
    CANCELLED: { icon: Ban, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Cancelled' },
  }[status] || { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: status };

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg}`}>
      <Icon className={`h-4 w-4 ${config.color} ${status === 'PROCESSING' || status === 'DISCOVERING' ? 'animate-spin' : ''}`} />
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}
