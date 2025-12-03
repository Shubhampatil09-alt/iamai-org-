'use client';

import { useState, useRef, useEffect } from 'react';
import { uploadPhoto, uploadPhotosBatch } from '@/actions/photos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X, CheckCircle, XCircle, Loader2, Clock, Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';
import GoogleDriveConnect from './GoogleDriveConnect';
import GoogleDriveFolderPicker from './GoogleDriveFolderPicker';
import ImportStartedDialog from './ImportStartedDialog';

type Room = {
  id: string;
  name: string;
};

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'single' | 'bulk';
};

type FileUploadStatus = {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  photoId?: string;
};

export default function UploadDialog({ open, onOpenChange, mode }: UploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  const [capturedAt, setCapturedAt] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [uploading, setUploading] = useState(false);

  // Google Drive states
  const [isGDriveConnected, setIsGDriveConnected] = useState(false);
  const [selectedGDriveFolder, setSelectedGDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [importStartedJobId, setImportStartedJobId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRooms();
      checkGoogleDriveConnection();
    }
  }, [open]);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
        // Auto-select first room if available
        if (data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Filter only image files
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      setFileStatuses(imageFiles.map(file => ({
        file,
        status: 'pending' as const,
      })));
    }
  };

  const removeFile = (index: number) => {
    setFileStatuses(statuses => statuses.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (fileStatuses.length === 0 || !selectedRoomId || !capturedAt) return;

    setUploading(true);

    // Get batch size from environment variable, default to 5
    const batchSize = parseInt(process.env.NEXT_PUBLIC_UPLOAD_BATCH_SIZE || '5', 10);

    // Process files in batches
    for (let i = 0; i < fileStatuses.length; i += batchSize) {
      const batchFiles = fileStatuses.slice(i, i + batchSize);
      const batchIndices = batchFiles.map((_, idx) => i + idx);

      // Mark all files in batch as uploading
      setFileStatuses(prev =>
        prev.map((fs, idx) =>
          batchIndices.includes(idx) ? { ...fs, status: 'uploading' as const } : fs
        )
      );

      // Upload batch in parallel
      const files = batchFiles.map(fs => fs.file);
      const capturedAtDate = capturedAt ? new Date(capturedAt) : null;

      const result = await uploadPhotosBatch(files, selectedRoomId, capturedAtDate);

      // Update statuses based on results
      setFileStatuses(prev =>
        prev.map((fs, idx) => {
          const batchIndex = batchIndices.indexOf(idx);
          if (batchIndex !== -1 && result.results[batchIndex]) {
            const uploadResult = result.results[batchIndex];
            return {
              ...fs,
              status: uploadResult.success ? 'success' as const : 'error' as const,
              error: uploadResult.error,
              photoId: uploadResult.photoId,
            };
          }
          return fs;
        })
      );
    }

    setUploading(false);

    // Refresh after all uploads complete
    setTimeout(() => {
      router.refresh();
    }, 1000);
  };

  const resetForm = () => {
    setFileStatuses([]);
    setCapturedAt('');
    setSelectedRoomId('');
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const checkGoogleDriveConnection = async () => {
    try {
      const response = await fetch('/api/auth/google/status');
      const data = await response.json();
      setIsGDriveConnected(data.connected);
    } catch (error) {
      console.error('Failed to check Google Drive connection:', error);
    }
  };

  const handleGoogleDriveImport = async () => {
    if (!selectedGDriveFolder || !selectedRoomId || !capturedAt) return;

    try {
      const response = await fetch('/api/gdrive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedGDriveFolder.id,
          folderName: selectedGDriveFolder.name,
          roomId: selectedRoomId,
          capturedAt,
          includeSubfolders: true,
        }),
      });

      const data = await response.json();

      if (data.jobId) {
        setImportStartedJobId(data.jobId);
        setShowImportDialog(true);
      }
    } catch (error) {
      console.error('Failed to start import:', error);
      alert('Failed to start import. Please try again.');
    }
  };

  const successCount = fileStatuses.filter(fs => fs.status === 'success').length;
  const errorCount = fileStatuses.filter(fs => fs.status === 'error').length;
  const uploadingCount = fileStatuses.filter(fs => fs.status === 'uploading').length;
  const uploadCompleted = fileStatuses.length > 0 && (successCount + errorCount) === fileStatuses.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {mode === 'single' ? 'Upload Photo' : 'Bulk Upload Photos'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="local" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local">Local Upload</TabsTrigger>
              <TabsTrigger value="gdrive">Google Drive</TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="flex-1 overflow-hidden flex flex-col">
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Room and Date Selection */}
                <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Room <span className="text-destructive">*</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                disabled={uploading || rooms.length === 0}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              {rooms.length === 0 && (
                <p className="text-xs text-destructive">
                  No rooms available. Please create a room first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Captured Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
                disabled={uploading}
                className="w-full"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 py-2 border-t border-b flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={uploading}
            >
              {uploading ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={fileStatuses.length === 0 || !selectedRoomId || !capturedAt || uploading || uploadCompleted}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading... ({successCount + errorCount}/{fileStatuses.length})
                </>
              ) : uploadCompleted ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Upload Complete
                </>
              ) : (
                `Upload ${fileStatuses.length > 0 ? `(${fileStatuses.length})` : ''}`
              )}
            </Button>
          </div>

          {/* Two-panel layout */}
          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Left Panel: File Selection */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20 flex flex-col overflow-hidden">
              <h3 className="text-sm font-semibold">Select Images</h3>

              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={mode === 'bulk'}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose {mode === 'bulk' ? 'Photos' : 'Photo'}
                  </Button>
                  {mode === 'bulk' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      Choose Folder
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {mode === 'bulk' ? 'Select multiple images or a folder with images' : 'Select an image'}
                </p>
              </div>

              {fileStatuses.length > 0 && (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <span className="text-xs font-medium">
                      {fileStatuses.length} file{fileStatuses.length !== 1 ? 's' : ''} selected
                    </span>
                    {!uploading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFileStatuses([])}
                        className="h-6 text-xs"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {fileStatuses.map((fileStatus, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-background rounded-md text-xs"
                      >
                        <span className="truncate flex-1">{fileStatus.file.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        {!uploading && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0 ml-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Upload Status */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-semibold">Upload Status</h3>
                {fileStatuses.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {successCount > 0 && <span className="text-green-600">{successCount} success</span>}
                    {errorCount > 0 && <span className="text-red-600 ml-2">{errorCount} failed</span>}
                    {uploadingCount > 0 && <span className="text-blue-600 ml-2">{uploadingCount} uploading</span>}
                  </div>
                )}
              </div>

              {fileStatuses.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                  No files selected
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {fileStatuses.map((fileStatus, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-background rounded-md border"
                    >
                      {/* Status Icon */}
                      <div className="mt-0.5">
                        {fileStatus.status === 'pending' && (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        {fileStatus.status === 'uploading' && (
                          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        )}
                        {fileStatus.status === 'success' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {fileStatus.status === 'error' && (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {fileStatus.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {fileStatus.status === 'error' && fileStatus.error && (
                          <p className="text-xs text-red-600 mt-1">
                            {fileStatus.error}
                          </p>
                        )}
                        {fileStatus.status === 'uploading' && (
                          <p className="text-xs text-blue-600 mt-1">
                            Uploading...
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="gdrive" className="flex-1 overflow-hidden flex flex-col space-y-4">
        {/* Room and Date Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Room <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              disabled={rooms.length === 0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            {rooms.length === 0 && (
              <p className="text-xs text-destructive">
                No rooms available. Please create a room first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Captured Date <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              className="w-full"
              required
            />
          </div>
        </div>

        {/* Google Drive Connection and Folder Picker */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <GoogleDriveConnect
            isConnected={isGDriveConnected}
            onConnect={() => checkGoogleDriveConnection()}
          />

          {isGDriveConnected && (
            <>
              <GoogleDriveFolderPicker
                onSelectFolder={(id, name) => setSelectedGDriveFolder({ id, name })}
              />

              <Button
                onClick={handleGoogleDriveImport}
                disabled={!selectedGDriveFolder || !selectedRoomId || !capturedAt}
                className="w-full"
              >
                Start Import from Google Drive
                {selectedGDriveFolder && ` (${selectedGDriveFolder.name})`}
              </Button>
            </>
          )}
        </div>
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>

{importStartedJobId && (
  <ImportStartedDialog
    open={showImportDialog}
    jobId={importStartedJobId}
    folderName={selectedGDriveFolder?.name || ''}
    onClose={() => {
      setShowImportDialog(false);
      onOpenChange(false);
      resetForm();
    }}
  />
)}
</>
  );
}
