import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';

const TABS = [
  { id: 'general', label: 'Paramètres généraux', icon: SlidersHorizontal },
];

export default function Settings() {
  const [tab, setTab] = useState('general');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1 flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-brand-400" />
          Paramètres
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-heading font-semibold border transition-all whitespace-nowrap',
              tab === id
                ? 'bg-brand-500/15 border-brand-500/35 text-brand-400'
                : 'border-white/[0.08] text-white/35 hover:text-white/60'
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* General tab — blank for now, content to be added later */}
      {tab === 'general' && (
        <section className="glass-card p-6">
          {/* À remplir */}
        </section>
      )}
    </motion.div>
  );
}
