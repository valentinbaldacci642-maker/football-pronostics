import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Target, Flame, BarChart3, Award, Activity } from 'lucide-react';
import { playersApi, leaguesApi } from '../services/api';
import { Spinner } from '../components/ui/Loading';

const TOOLTIP_STYLE = {
  background: '#0f1629',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const LEAGUE_COLORS = {
  39: '#7c3aed',
  140: '#dc2626',
  78: '#d97706',
  135: '#2563eb',
  61: '#16a34a',
};

export default function Analytics() {
  const [topScorers, setTopScorers] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(39);
  const [loading, setLoading] = useState(false);

  const simulatedData = {
    valueDetection: [
      { month: 'Oct', found: 23, converted: 14 },
      { month: 'Nov', found: 31, converted: 19 },
      { month: 'Dec', found: 28, converted: 17 },
      { month: 'Jan', found: 35, converted: 22 },
      { month: 'Feb', found: 29, converted: 18 },
      { month: 'Mar', found: 41, converted: 26 },
    ],
    marketDist: [
      { name: '1X2', value: 45, color: '#10b981' },
      { name: 'O/U', value: 28, color: '#3b82f6' },
      { name: 'BTTS', value: 16, color: '#f59e0b' },
      { name: 'Score', value: 7, color: '#8b5cf6' },
      { name: 'Autres', value: 4, color: '#6b7280' },
    ],
    confidence: [
      { label: 'Très fiable (75%+)', value: 12, color: '#22c55e' },
      { label: 'Fiable (60-75%)', value: 28, color: '#84cc16' },
      { label: 'Modéré (50-60%)', value: 35, color: '#f59e0b' },
      { label: 'Risqué (<50%)', value: 25, color: '#ef4444' },
    ],
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await playersApi.getTopScorers(selectedLeague, 2024);
        setTopScorers(data?.response?.slice(0, 10) || []);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, [selectedLeague]);

  const LEAGUES_SELECT = [
    { id: 39, name: 'Premier League' },
    { id: 140, name: 'La Liga' },
    { id: 78, name: 'Bundesliga' },
    { id: 135, name: 'Serie A' },
    { id: 61, name: 'Ligue 1' },
  ];

  const kpis = [
    { label: 'Matchs analysés', value: '1,284', icon: BarChart3, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Value bets détectés', value: '187', icon: Flame, color: 'text-gold-400', bg: 'bg-gold-500/10' },
    { label: 'Taux de précision', value: '68.4%', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'ROI moyen (Kelly)', value: '+12.3%', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">Dashboard <span className="text-brand-400">Analytics</span></h1>
        <p className="text-sm text-white/35 font-heading font-medium mt-1">Performance globale · Saison 2024/2025</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            whileHover={{ y: -2 }}
            className="glass-card p-4"
          >
            <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
            </div>
            <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Value bets trend */}
        <div className="glass-card p-5 lg:col-span-3">
          <h3 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-gold-400" />
            Évolution des value bets
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={simulatedData.valueDetection}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="found" stroke="#f59e0b" strokeWidth={2} dot={false} name="Détectés" />
              <Line type="monotone" dataKey="converted" stroke="#10b981" strokeWidth={2} dot={false} name="Convertis" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Market distribution */}
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-white/80 mb-4">Répartition par marché</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={simulatedData.marketDist} cx="50%" cy="50%" outerRadius={55} dataKey="value" strokeWidth={0}>
                {simulatedData.marketDist.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Part']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {simulatedData.marketDist.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-white/50">{d.name}</span>
                </div>
                <span className="font-bold text-white/80">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confidence distribution */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-white/80 mb-5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Distribution des niveaux de confiance
        </h3>
        <div className="space-y-3">
          {simulatedData.confidence.map((item, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-white/70 font-medium">{item.label}</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: item.color }}>{item.value}%</span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
          <span>Total pronostics simulés</span>
          <span className="font-bold text-white/50">~100 pronos</span>
        </div>
      </div>

      {/* Top Scorers */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
            <Award className="w-4 h-4 text-gold-400" />
            Meilleurs buteurs
          </h3>
          <div className="flex gap-2">
            {LEAGUES_SELECT.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLeague(l.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedLeague === l.id ? 'bg-brand-500/20 text-brand-300' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {l.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {topScorers.map((item, i) => {
              const { player, statistics } = item;
              const goals = statistics?.[0]?.goals?.total || 0;
              const assists = statistics?.[0]?.goals?.assists || 0;
              const maxGoals = topScorers[0]?.statistics?.[0]?.goals?.total || 1;

              return (
                <div key={player.id} className="flex items-center gap-3 py-2">
                  <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-gold-400' : i < 3 ? 'text-white/60' : 'text-white/30'}`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-dark-700 overflow-hidden flex-shrink-0">
                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover"
                      onError={(e) => e.target.style.display = 'none'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-dark-600 max-w-[120px]">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(goals / maxGoals) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-sm font-black text-white">{goals}</span>
                      <p className="text-xs text-white/30">buts</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white/50">{assists}</span>
                      <p className="text-xs text-white/25">ass.</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
