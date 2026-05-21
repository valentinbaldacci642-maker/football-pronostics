// MimiMétéo look-alike building blocks: coloured pill badges + risk tiles,
// using the exact hex palette from the original app.

export function InfoBadge({ icon, risk, text }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold"
      style={{ backgroundColor: risk.bgHex, borderColor: risk.color, color: risk.color }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{text}</span>
    </span>
  );
}

export function RiskTile({ icon, label, risk, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[45%] rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-transform active:scale-[0.97]"
      style={{ backgroundColor: risk.bgHex, border: `1.5px solid ${risk.color}` }}
    >
      <span className="text-[28px] leading-none">{icon}</span>
      <span className="text-[13px] font-semibold tracking-wide" style={{ color: '#e2e8f0' }}>{label}</span>
      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: risk.color }}>
        {risk.label}
      </span>
      {subtitle && <span className="text-[11px] font-medium text-center" style={{ color: risk.color }}>{subtitle}</span>}
    </button>
  );
}

export function orageText(risk) {
  return risk.key === 'FAIBLE' ? 'Aucun risque' : `Orage ${risk.label}`;
}
export function violentText(risk) {
  return risk.key === 'FAIBLE' ? 'Aucun risque violent' : `Violent ${risk.label}`;
}
