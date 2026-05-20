import { useCallback, useRef, useState } from 'react';

/**
 * Hook to prevent multiple rapid clicks on buttons or interactive elements.
 * Useful for critical actions like payments or order submissions.
 */
export function useAntiDebounce() {
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const lastClickRef = useRef<number>(0);

  const debounce = useCallback((fn: (...args: any[]) => any, delay: number = 1000) => {
    return async (...args: any[]) => {
      const now = Date.now();
      if (now - lastClickRef.current < delay || isProcessingRef.current) {
        return;
      }

      lastClickRef.current = now;
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
        await fn(...args);
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    };
  }, []);

  return {
    debounce,
    isProcessing,
  };
}
