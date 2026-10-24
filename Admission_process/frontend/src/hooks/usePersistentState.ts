import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import sessionDraftService from '../services/sessionDraft.service';

/**
 * A persistent state hook that survives browser reloads, switching tabs, and route navigation.
 * Backed by LocalStorage + SessionStorage with background Redis session synchronization.
 *
 * @param key Unique key identifier for this state (e.g. 'hod_create_faculty_form')
 * @param initialValue Default value if no saved draft is found
 * @param options Configuration options
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
  options: {
    syncRedis?: boolean;
    debounceMs?: number;
    ttlSeconds?: number;
  } = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  const { syncRedis = true, debounceMs = 500, ttlSeconds } = options;
  const user = useSelector((state: RootState) => state.auth.user);
  const userId = user?.id ? String(user.id) : 'guest';

  const [isRestored, setIsRestored] = useState<boolean>(false);

  // Synchronous initialization from local storage
  const [state, setState] = useState<T>(() => {
    const localDraft = sessionDraftService.getLocalDraft<T>(key, userId);
    if (localDraft !== null && localDraft !== undefined) {
      return localDraft;
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  const stateRef = useRef<T>(state);
  stateRef.current = state;

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Immediate save helper without debounce (for pagehide, visibilitychange, unmount)
  const flushSave = useCallback(() => {
    sessionDraftService.saveLocalDraft(key, stateRef.current, userId);
    if (syncRedis && user?.id) {
      sessionDraftService.saveRedisDraft(key, stateRef.current, ttlSeconds);
    }
  }, [key, userId, syncRedis, ttlSeconds, user?.id]);

  // Check Redis on initial mount for any remote draft if local wasn't found or as a fallback
  useEffect(() => {
    let isMounted = true;
    const loadRemoteDraft = async () => {
      const localDraft = sessionDraftService.getLocalDraft<T>(key, userId);
      if (localDraft !== null && localDraft !== undefined) {
        setIsRestored(true);
        return;
      }

      if (syncRedis && user?.id) {
        const redisDraft = await sessionDraftService.getRedisDraft<T>(key);
        if (isMounted && redisDraft !== null && redisDraft !== undefined) {
          setState(redisDraft);
          sessionDraftService.saveLocalDraft(key, redisDraft, userId);
          setIsRestored(true);
        }
      }
    };

    loadRemoteDraft();
    return () => {
      isMounted = false;
    };
  }, [key, userId, syncRedis, user?.id]);

  // Handle visibilitychange & beforeunload events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };

    const handleBeforeUnload = () => {
      flushSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [flushSave]);

  // Update state setter with automatic debounce persistence
  const setPersistentState = useCallback(
    (action: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof action === 'function' ? (action as (prev: T) => T)(prev) : action;
        stateRef.current = next;

        // Immediate write to local storage (instant safety)
        sessionDraftService.saveLocalDraft(key, next, userId);

        // Debounced Redis sync (efficient network utilization)
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
          if (syncRedis && user?.id) {
            sessionDraftService.saveRedisDraft(key, next, ttlSeconds);
          }
        }, debounceMs);

        return next;
      });
    },
    [key, userId, syncRedis, debounceMs, ttlSeconds, user?.id]
  );

  // Clear draft method (call upon successful submit or cancel)
  const clearDraft = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    sessionDraftService.clearAllDrafts(key, userId);
    const defaultVal = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    setState(defaultVal);
    stateRef.current = defaultVal;
  }, [key, userId, initialValue]);

  return [state, setPersistentState, clearDraft, isRestored];
}

export default usePersistentState;
