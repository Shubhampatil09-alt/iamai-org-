export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
};

export type GoogleDriveFolder = {
  id: string;
  name: string;
  parentId?: string;
  fileCount?: number;
};

export type ImportJobWithDetails = {
  id: string;
  folderId: string;
  folderName: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  successFiles: number;
  failedFiles: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  room: {
    id: string;
    name: string;
  };
};

export type SQSImportMessage = {
  jobId: string;
  fileId: string;
  googleDriveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  userId: string;
  roomId: string;
  capturedAt: string | null;
};
