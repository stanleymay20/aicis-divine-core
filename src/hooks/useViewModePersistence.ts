/**
 * Persistent View Mode Hook
 * Stores Executive/Analyst mode preference in localStorage
 */
import { useState, useEffect, useCallback } from 'react';
import type { ViewMode } from '@/components/aicis/AnalystMode';

const STORAGE_KEY = 'aicis-view-mode';

export const useViewModePersistence = (defaultMode: ViewMode = 'executive') => {
  const [mode, setModeState] = useState<ViewMode>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'executive' || stored === 'analyst') {
        return stored;
      }
    }
    return defaultMode;
  });
  
  // Persist to localStorage when mode changes
  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);
  
  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        if (e.newValue === 'executive' || e.newValue === 'analyst') {
          setModeState(e.newValue);
        }
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  return { mode, setMode };
};
