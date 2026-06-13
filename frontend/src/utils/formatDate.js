/** Parse YYYY-MM-DD (or ISO datetime) as local calendar date — avoids UTC off-by-one in labels. */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [datePart] = String(dateStr).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDateOnly(dateStr, locale = 'en-US', options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = parseLocalDate(dateStr);
  if (!d) return String(dateStr ?? '');
  return d.toLocaleDateString(locale, options);
}

export function isSameYearMonth(dateStr, year, month) {
  const d = parseLocalDate(dateStr);
  if (!d) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}
