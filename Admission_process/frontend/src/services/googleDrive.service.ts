import API from './api';

export interface GoogleDriveStatus {
  connected: boolean;
  isConnected: boolean;
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'DISCONNECTED';
  accountEmail: string | null;
  googleAccountEmail: string | null;
  accountName: string | null;
  rootFolder: string;
  rootFolderName: string;
  rootFolderId: string | null;
  autoBackupEnabled: boolean;
  lastSuccessfulSync: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  connectedBy: string | null;
  activeWorkbooks: number;
  totalSyncedFiles: number;
  pendingBackups: number;
  failedBackups: number;
  pendingJobsCount: number;
  failedJobsCount: number;
  stats?: {
    activeWorkbooks: number;
    totalSyncedFiles: number;
    pendingBackups: number;
    failedBackups: number;
  };
}

export const googleDriveService = {
  /**
   * Retrieves Google Drive integration & backup status
   */
  async getStatus(): Promise<GoogleDriveStatus> {
    const response = await API.get('/google-drive/status');
    return response.data.data;
  },

  /**
   * Retrieves OAuth authorization URL
   */
  async getAuthUrl(): Promise<string> {
    const response = await API.get('/google/oauth?format=json');
    return response.data.authUrl;
  },

  /**
   * Tests Google Drive connectivity and root folder verification
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const response = await API.post('/google-drive/test-connection');
    return response.data;
  },

  /**
   * Disconnects Google Drive integration
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await API.post('/google-drive/disconnect');
    return response.data;
  },

  /**
   * Toggles automatic backup on or off
   */
  async toggleAutoBackup(enabled: boolean): Promise<{ autoBackupEnabled: boolean }> {
    const response = await API.post('/google-drive/toggle-auto-backup', { enabled });
    return response.data.data;
  },

  /**
   * Triggers immediate retry for failed and pending backup jobs
   */
  async retryFailedBackups(): Promise<{ retriedCount: number }> {
    const response = await API.post('/google-drive/retry-failed');
    return response.data.data;
  },
};

export default googleDriveService;
