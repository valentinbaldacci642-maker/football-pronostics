import { useEffect, useRef } from 'react';

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);

export const isLiveStatus = (short) => !!short && LIVE_STATUSES.has(short);

// Auto-refresh `refresh()` on a fixed interval while at least one displayed
// fixture is live. The interval is torn down when the component unmounts or
// when no live fixture remains, so navigating away or finishing matches stops
// polling automatically. Backend caches live fixtures for 60s so a 30s
// frontend cadence is fine on the API side (cache absorbs duplicate hits).
export function useLivePolling(hasLive, refresh, intervalMs = 30000) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!hasLive) return undefined;
    const id = setInterval(() => refreshRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [hasLive, intervalMs]);
}
