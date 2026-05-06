import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { subscribeRateLimit, getRateLimitedUntil } from '../../services/api';

export default function RateLimitBanner() {
  const [until, setUntil] = useState(getRateLimitedUntil());
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeRateLimit(setUntil), []);

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [until]);

  const remaining = Math.max(0, until - now);
  const visible = remaining > 0;
  const sec = Math.ceil(remaining / 1000);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="fixed top-14 left-0 right-0 lg:left-64 z-30 px-4 md:px-6"
        >
          <div className="mx-auto max-w-3xl mt-2 px-3.5 py-2 rounded-xl bg-orange-500/[0.12] border border-orange-500/30 flex items-center gap-2 backdrop-blur">
            <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="text-sm text-orange-200 font-heading flex-1 truncate">
              API surchargée — patiente <span className="font-mono font-semibold tabular-nums">{sec} s</span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
