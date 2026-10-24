import { useState, useEffect, useCallback, useRef } from 'react';
import principalService from '../services/principal.service';

interface UsePrincipalNotificationCountOptions {
  pollingIntervalMs?: number; // default: 10000ms (10 seconds)
  enabled?: boolean;
}

export const usePrincipalNotificationCount = (options: UsePrincipalNotificationCountOptions = {}) => {
  const { pollingIntervalMs = 10000, enabled = true } = options;
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);

  const fetchCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await principalService.getFacultyAuthorizationNotificationCount();
      if (isMountedRef.current && typeof data?.count === 'number') {
        setCount(data.count);
      }
    } catch (err) {
      console.warn('Failed to fetch Principal authorization notification count:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCount();

    if (!enabled) return;

    // Periodic polling to update count automatically
    const timer = setInterval(() => {
      fetchCount();
    }, pollingIntervalMs);

    // Refresh immediately when window/tab is focused
    const handleFocus = () => {
      fetchCount();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh immediately when local faculty authorization status changes
    const handleAuthChanged = () => {
      fetchCount();
    };
    window.addEventListener('faculty-auth-changed', handleAuthChanged);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('faculty-auth-changed', handleAuthChanged);
    };
  }, [fetchCount, pollingIntervalMs, enabled]);

  return {
    count,
    loading,
    refreshCount: fetchCount,
  };
};

export default usePrincipalNotificationCount;
