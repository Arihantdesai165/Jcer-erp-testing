import API from './api';

export interface DraftEnvelope<T> {
  data: T;
  updatedAt: number;
  userId?: string;
}

class SessionDraftService {
  private getStorageKey(key: string, userId?: string): string {
    const userScope = userId || 'current';
    return `jcer_draft_${userScope}_${key}`;
  }

  /**
   * Get draft synchronously from localStorage / sessionStorage
   */
  public getLocalDraft<T>(key: string, userId?: string): T | null {
    const storageKey = this.getStorageKey(key, userId);
    try {
      // 1. Check sessionStorage first (current active browser tab session)
      const sessionVal = sessionStorage.getItem(storageKey);
      if (sessionVal) {
        const parsed = JSON.parse(sessionVal);
        return parsed?.data !== undefined ? parsed.data : parsed;
      }

      // 2. Check localStorage (persisted across tabs and refreshes)
      const localVal = localStorage.getItem(storageKey);
      if (localVal) {
        const parsed = JSON.parse(localVal);
        return parsed?.data !== undefined ? parsed.data : parsed;
      }
    } catch (err) {
      console.warn(`[SessionDraft] Failed to read local draft for key ${key}:`, err);
    }
    return null;
  }

  /**
   * Save draft synchronously to localStorage and sessionStorage
   */
  public saveLocalDraft<T>(key: string, data: T, userId?: string): void {
    const storageKey = this.getStorageKey(key, userId);
    try {
      const envelope: DraftEnvelope<T> = {
        data,
        updatedAt: Date.now(),
        userId,
      };
      const serialized = JSON.stringify(envelope);
      sessionStorage.setItem(storageKey, serialized);
      localStorage.setItem(storageKey, serialized);
    } catch (err) {
      console.warn(`[SessionDraft] Failed to save local draft for key ${key}:`, err);
    }
  }

  /**
   * Remove draft from local storage & session storage
   */
  public removeLocalDraft(key: string, userId?: string): void {
    const storageKey = this.getStorageKey(key, userId);
    try {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch (err) {
      console.warn(`[SessionDraft] Failed to delete local draft for key ${key}:`, err);
    }
  }

  /**
   * Fetch draft from backend Redis session store
   */
  public async getRedisDraft<T>(key: string): Promise<T | null> {
    try {
      const res = await API.get(`/auth/drafts/${encodeURIComponent(key)}`);
      if (res.data?.success && res.data?.data !== undefined) {
        return res.data.data;
      }
    } catch (err) {
      // Silent catch — fallback to local storage
    }
    return null;
  }

  /**
   * Save draft to backend Redis session store (TTL: 7 days)
   */
  public async saveRedisDraft<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    try {
      await API.post(`/auth/drafts/${encodeURIComponent(key)}`, {
        data,
        ttlSeconds: ttlSeconds || 7 * 24 * 60 * 60,
      });
    } catch (err) {
      // Silent catch — local storage remains intact
    }
  }

  /**
   * Remove draft from backend Redis session store
   */
  public async deleteRedisDraft(key: string): Promise<void> {
    try {
      await API.delete(`/auth/drafts/${encodeURIComponent(key)}`);
    } catch (err) {
      // Silent catch
    }
  }

  /**
   * Completely clear draft across all layers (LocalStorage, SessionStorage & Redis)
   */
  public async clearAllDrafts(key: string, userId?: string): Promise<void> {
    this.removeLocalDraft(key, userId);
    await this.deleteRedisDraft(key);
  }
}

export const sessionDraftService = new SessionDraftService();
export default sessionDraftService;
