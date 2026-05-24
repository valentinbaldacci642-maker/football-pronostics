import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { analyzeWeather, severityColor } from '../../services/weatherInsights';

// Smart weather banner: a fun French recap + smart alert chips (gel, accalmie,
// chaleur/froid, UV, pollen, air). Pure display over the analyzeWeather engine.
//
// variant="full"    → météo détaillée d'une ville (sous la vigilance)
// variant="compact" → widget Hub (résumé court + pastilles)
export default function WeatherInsights({ forecast, airQuality, variant = 'full' }) {
  const { conditions, summary } = useMemo(
    () => analyzeWeather({ forecast, airQuality }),
    [forecast, airQuality],
  );

  if (!summary && conditions.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="mt-2 space-y-1.5">
        {summary && <p className="text-xs text-white/75 leading-snug line-clamp-2">{summary}</p>}
        {conditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {conditions.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: `${severityColor(c.severity)}22`, color: severityColor(c.severity) }}
                title={`${c.title} · ${c.detail}`}
              >
                <span>{c.emoji}</span>{c.title}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // full
  return (
    <div className="mb-5 rounded-2xl p-4 bg-white/[0.04] border border-white/10 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-brand-400" />
        <span className="text-[11px] font-heading font-bold tracking-[2px] text-white/45">LE TOPO MÉTÉO</span>
      </div>
      {summary && (
        <p className="text-sm text-white/85 leading-relaxed font-heading">{summary}</p>
      )}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {conditions.map((c) => {
            const col = severityColor(c.severity);
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: `${col}1f`, color: col, border: `1px solid ${col}55` }}
              >
                <span>{c.emoji}</span>
                <span>{c.title}</span>
                {c.detail && <span className="font-medium opacity-80">· {c.detail}</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
