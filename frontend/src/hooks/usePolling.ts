import { useEffect, useRef } from 'react';

/**
 * Hook for polling data at regular intervals.
 * Uses a guard to prevent overlapping calls when the callback is async
 * and takes longer than the interval.
 *
 * @param callback - Function to call on each poll
 * @param interval - Polling interval in milliseconds (default: 30000ms = 30 seconds)
 * @param isActive - Whether polling should be active (default: true)
 */
export function usePolling(
  callback: () => void | Promise<void>,
  interval: number = 30000,
  isActive: boolean = true
) {
  const callbackRef = useRef(callback);
  const isRunningRef = useRef(false);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isActive) return;

    const execute = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        isRunningRef.current = false;
      }
    };

    const intervalId = setInterval(execute, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [interval, isActive]);
}
