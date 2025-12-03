import { google } from 'googleapis';
import { prisma } from './prisma';
import { decrypt, encrypt } from './encryption';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent', // Force to get refresh token
  });
}

export async function getAuthenticatedDriveClient(userId: string) {
  const auth = await prisma.googleDriveAuth.findUnique({
    where: { userId },
  });

  if (!auth) {
    throw new Error('Google Drive not connected');
  }

  const oauth2Client = getOAuth2Client();

  // Check if token expired
  const now = new Date();
  if (auth.expiresAt < now) {
    // Refresh token
    oauth2Client.setCredentials({
      refresh_token: decrypt(auth.refreshToken),
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update stored tokens
    await prisma.googleDriveAuth.update({
      where: { userId },
      data: {
        accessToken: encrypt(credentials.access_token!),
        expiresAt: new Date(credentials.expiry_date!),
      },
    });

    oauth2Client.setCredentials(credentials);
  } else {
    oauth2Client.setCredentials({
      access_token: decrypt(auth.accessToken),
      refresh_token: decrypt(auth.refreshToken),
    });
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function listFolders(userId: string, parentId?: string) {
  const drive = await getAuthenticatedDriveClient(userId);

  const query = parentId
    ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, parents, createdTime)',
    orderBy: 'name',
    pageSize: 1000,
  });

  return response.data.files || [];
}

export async function listAllFilesInFolder(
  userId: string,
  folderId: string,
  includeSubfolders: boolean = true
): Promise<any[]> {
  const drive = await getAuthenticatedDriveClient(userId);
  const allFiles: any[] = [];
  const foldersToProcess = [folderId];

  while (foldersToProcess.length > 0) {
    const currentFolderId = foldersToProcess.pop()!;

    // List image files in current folder
    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed=false and (mimeType contains 'image/')`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
        pageSize: 1000,
        pageToken,
      });

      if (response.data.files) {
        allFiles.push(...response.data.files);
      }

      pageToken = response.data.nextPageToken || undefined;

      // Rate limit protection
      await new Promise(resolve =>
        setTimeout(resolve, parseInt(process.env.GDRIVE_API_DELAY_MS || '100'))
      );
    } while (pageToken);

    // If including subfolders, find and add them
    if (includeSubfolders) {
      const subfolders = await drive.files.list({
        q: `'${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1000,
      });

      if (subfolders.data.files) {
        foldersToProcess.push(...subfolders.data.files.map(f => f.id!));
      }
    }
  }

  return allFiles;
}

export async function downloadFile(userId: string, fileId: string): Promise<Buffer> {
  const drive = await getAuthenticatedDriveClient(userId);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}
