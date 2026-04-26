export const oddsToProb = (odd) => {
  if (!odd || odd <= 0) return 0;
  return parseFloat(((1 / odd) * 100).toFixed(1));
};

export const getConfidenceColor = (prob) => {
  if (prob >= 70) return '#22c55e';
  if (prob >= 55) return '#84cc16';
  if (prob >= 40) return '#f59e0b';
  if (prob >= 25) return '#f97316';
  return '#ef4444';
};

export const getConfidenceLabel = (prob) => {
  if (prob >= 75) return 'Très fiable';
  if (prob >= 60) return 'Fiable';
  if (prob >= 50) return 'Modéré';
  if (prob >= 35) return 'Risqué';
  return 'Très risqué';
};

export const getConfidenceBg = (prob) => {
  if (prob >= 70) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (prob >= 55) return 'bg-lime-500/20 text-lime-400 border-lime-500/30';
  if (prob >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (prob >= 25) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};

export const formatOdd = (odd) => {
  if (!odd) return '—';
  return parseFloat(odd).toFixed(2);
};

export const isValueBet = (trueProb, bookOdd, threshold = 5) => {
  if (!bookOdd || bookOdd <= 0) return false;
  const impliedProb = oddsToProb(bookOdd);
  return trueProb - impliedProb >= threshold;
};

export const outcomeColor = (outcome) => {
  const map = {
    W: 'text-green-400 bg-green-500/15',
    D: 'text-amber-400 bg-amber-500/15',
    L: 'text-red-400 bg-red-500/15',
  };
  return map[outcome] || 'text-white/40';
};
