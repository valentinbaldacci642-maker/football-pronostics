import { format, parseISO, isToday, isTomorrow, isYesterday, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatMatchDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return `Aujourd'hui ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Demain ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Hier ${format(date, 'HH:mm')}`;
    return format(date, 'dd MMM · HH:mm', { locale: fr });
  } catch {
    return dateStr;
  }
};

export const formatTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'HH:mm');
  } catch {
    return dateStr;
  }
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd/MM', { locale: fr });
  } catch {
    return dateStr;
  }
};

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: fr });
  } catch {
    return dateStr;
  }
};

export const formatDateInput = (dateStr) => {
  if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
  return dateStr;
};

export const getMatchStatus = (fixture) => {
  const status = fixture?.fixture?.status;
  if (!status) return { label: '—', type: 'unknown' };

  const { short, elapsed } = status;
  // HT and INT/SUSP are still 'live' for display purposes — the match is
  // ongoing, the score is current, and we want the red indicator + score
  // to stay visible. Without HT here, halftime would render as "unknown"
  // and the live score block would disappear.
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
  const finishedStatuses = ['FT', 'AET', 'PEN'];
  const scheduledStatuses = ['NS', 'TBD'];
  const cancelledStatuses = ['CANC', 'ABD', 'AWD', 'WO'];
  const postponedStatuses = ['PST', 'SUSP', 'INT'];

  if (short === 'HT') return { label: 'Mi-temps', type: 'live' };
  if (liveStatuses.includes(short)) return { label: elapsed ? `${elapsed}'` : 'LIVE', type: 'live' };
  if (finishedStatuses.includes(short)) return { label: 'Terminé', type: 'finished' };
  if (scheduledStatuses.includes(short)) return { label: 'Programmé', type: 'scheduled' };
  if (cancelledStatuses.includes(short)) return { label: 'Annulé', type: 'cancelled' };
  if (postponedStatuses.includes(short)) return { label: 'Reporté', type: 'postponed' };
  return { label: short, type: 'unknown' };
};

export const getScoreDisplay = (fixture) => {
  const goals = fixture?.goals;
  const status = fixture?.fixture?.status?.short;
  const finishedOrLive = ['FT', 'AET', 'PEN', '1H', '2H', 'ET', 'BT', 'P'].includes(status);

  if (!finishedOrLive || goals?.home === null) return null;
  return { home: goals.home ?? 0, away: goals.away ?? 0 };
};

export const capitalizeFirst = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

export const truncate = (str, len = 24) =>
  str && str.length > len ? `${str.slice(0, len)}…` : str;
