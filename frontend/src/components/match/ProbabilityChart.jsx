import { RadialBarChart, RadialBar, Cell, ResponsiveContainer, PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';

export function ProbabilityDonut({ home, draw, away, homeTeam, awayTeam }) {
  const data = [
    { name: homeTeam || 'Domicile', value: home, color: '#10b981' },
    { name: 'Nul', value: draw, color: '#f59e0b' },
    { name: awayTeam || 'Extérieur', value: away, color: '#3b82f6' },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.85} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value?.toFixed(1)}%`, 'Probabilité']}
            contentStyle={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black text-white">{Math.max(home, draw, away).toFixed(0)}%</p>
          <p className="text-xs text-white/40">Max prob.</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-xs text-white/50">{d.name}</span>
            <span className="text-xs font-bold text-white">{d.value?.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparisonBars({ home, away, label, homeColor = '#10b981', awayColor = '#3b82f6' }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-white/40 font-medium text-center">{label}</p>}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/60 w-8 text-right font-mono">{home?.toFixed(0)}%</span>
        <div className="flex-1 flex gap-1 h-2">
          <div className="flex-1 flex justify-end">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${home}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: homeColor }}
            />
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${away}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: awayColor }}
            />
          </div>
        </div>
        <span className="text-xs text-white/60 w-8 font-mono">{away?.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function GoalsHistogram({ data = [] }) {
  if (!data.length) return null;
  const top6 = data.slice(0, 6);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={top6} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="score" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${v?.toFixed(1)}%`, 'Probabilité']}
          contentStyle={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
        />
        <Bar dataKey="prob" radius={[4, 4, 0, 0]} fill="#10b981" opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConfidenceGauge({ value, label }) {
  const color = value >= 70 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle
            cx="40" cy="40" r="30"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 30}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 30 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 30 * (1 - value / 100) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-black" style={{ color }}>{value?.toFixed(0)}%</span>
        </div>
      </div>
      {label && <p className="text-xs text-white/40">{label}</p>}
    </div>
  );
}
