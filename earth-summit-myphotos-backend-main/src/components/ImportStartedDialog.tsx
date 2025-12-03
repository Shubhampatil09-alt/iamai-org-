'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Props = {
  open: boolean;
  jobId: string;
  folderName: string;
  onClose: () => void;
};

export default function ImportStartedDialog({ open, jobId, folderName, onClose }: Props) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Import Started Successfully
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              Your import from <strong>{folderName}</strong> has been queued and is processing in the background.
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <p>✓ You can safely close this page</p>
            <p>✓ The import will continue in the background</p>
            <p>✓ Check the Import Jobs page for progress</p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => router.push(`/dashboard/imports?jobId=${jobId}`)}
              className="flex-1"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Progress
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
