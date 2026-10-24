import { useCallback } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * Hook tailored for complex forms with multiple fields and nested structures (like arrays of assignments).
 * Ensures every keystroke, selection, and allocation survives page reload, tab switching, and navigation.
 *
 * @param formKey Unique identifier for the form (e.g. 'hod_create_faculty_form')
 * @param initialFormValues Default values for form fields
 * @param options Persistence options
 */
export function usePersistentFormState<T extends Record<string, any>>(
  formKey: string,
  initialFormValues: T,
  options?: {
    syncRedis?: boolean;
    debounceMs?: number;
    ttlSeconds?: number;
  }
) {
  const [formState, setFormState, clearDraft, isRestored] = usePersistentState<T>(
    formKey,
    initialFormValues,
    options
  );

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K] | ((prevVal: T[K]) => T[K])) => {
      setFormState((prev) => {
        const nextVal = typeof value === 'function' ? (value as (prevVal: T[K]) => T[K])(prev[field]) : value;
        return {
          ...prev,
          [field]: nextVal,
        };
      });
    },
    [setFormState]
  );

  const resetForm = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return {
    formState,
    updateField,
    setFormState,
    resetForm,
    clearDraft,
    isRestored,
  };
}

export default usePersistentFormState;
