'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Cloud, CheckCircle, XCircle } from 'lucide-react';

type Props = {
  isConnected: boolean;
  onConnect: () => void;
};

export default function GoogleDriveConnect({ isConnected, onConnect }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to initiate Google Drive connection:', error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive? You can reconnect anytime.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/auth/google/status', {
        method: 'DELETE',
      });

      if (response.ok) {
        onConnect(); // Refresh the connection status
      } else {
        console.error('Failed to disconnect Google Drive');
        alert('Failed to disconnect Google Drive. Please try again.');
      }
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error);
      alert('Failed to disconnect Google Drive. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-900">
            Google Drive Connected
          </span>
        </div>
        <Button
          onClick={handleDisconnect}
          disabled={disconnecting}
          variant="outline"
          size="sm"
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          {disconnecting ? 'Disconnecting...' : 'Disconnect Google Drive'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <XCircle className="h-5 w-5 text-yellow-600" />
        <span className="text-sm text-yellow-900">
          Connect Google Drive to import photos
        </span>
      </div>
      <Button
        onClick={handleConnect}
        disabled={connecting}
        className="w-full"
      >
        <Cloud className="mr-2 h-4 w-4" />
        {connecting ? 'Connecting...' : 'Connect Google Drive'}
      </Button>
    </div>
  );
}
