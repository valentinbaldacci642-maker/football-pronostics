/**
 * Export bankroll history entries to a CSV file the user can download.
 * Includes all settled bets with mise > 0 + their result, P&L and notes.
 */
function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  // RFC 4180: wrap in quotes if comma/quote/newline; double-up internal quotes
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportBankrollCsv(entries, filename = 'bankroll-history.csv') {
  const headers = [
    'date_pari', 'match_date', 'home_team', 'away_team', 'league',
    'pick', 'odd_systeme', 'odd_reelle', 'mise', 'result',
    'final_score', 'pnl', 'note',
  ];

  const rows = entries
    .filter((e) => e.mise > 0)
    .sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0))
    .map((e) => {
      const effOdd = parseFloat(e.actualOdd || e.odd || 0);
      const pnl = e.result === 'win' ? e.mise * (effOdd - 1)
        : e.result === 'loss' ? -e.mise
        : 0;
      return [
        e.date || '',
        e.savedAt ? new Date(e.savedAt).toISOString().split('T')[0] : '',
        e.homeTeam || '',
        e.awayTeam || '',
        e.league || '',
        e.pickLabel || e.pick || '',
        e.odd != null ? e.odd : '',
        e.actualOdd != null ? e.actualOdd : '',
        e.mise != null ? e.mise : '',
        e.result || 'pending',
        e.finalScore || '',
        pnl.toFixed(2),
        e.note || '',
      ];
    });

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');

  // Add UTF-8 BOM so Excel opens it with the correct encoding
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
