import { useState, useEffect } from 'react';
import { Platform, InteractionManager } from 'react-native';

/**
 * Defers heavy rendering until after the first frame / navigation transition
 * completes. On web, uses a simple setTimeout to yield back to the browser.
 * On native, uses InteractionManager.runAfterInteractions.
 */
export function useDeferredReady(delayMs = 150): boolean {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    console.log('[useDeferredReady] useEffect triggered. Platform:', Platform.OS);
    if (Platform.OS === 'web') {
      console.log('[useDeferredReady] Web: Scheduling setTimeout for', delayMs, 'ms');
      const timerId = setTimeout(() => {
        console.log('[useDeferredReady] Web: Timeout finished, setting ready = true');
        setReady(true);
      }, delayMs);

      return () => {
        console.log('[useDeferredReady] Web: Cleaning up timeout');
        clearTimeout(timerId);
      };
    } else {
      console.log('[useDeferredReady] Native: Scheduling runAfterInteractions');
      const handle = InteractionManager.runAfterInteractions(() => {
        console.log('[useDeferredReady] Native: runAfterInteractions triggered, setting ready = true');
        setReady(true);
      });
      return () => {
        console.log('[useDeferredReady] Native: Cleaning up interaction handle');
        handle.cancel();
      };
    }
  }, [delayMs]);

  return ready;
}

