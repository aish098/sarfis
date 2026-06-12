import { create } from 'zustand';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function loadPeriod(companyId) {
  const now = new Date();
  const fallback = { month: now.getMonth() + 1, year: now.getFullYear() };
  if (!companyId) return fallback;
  try {
    const raw = localStorage.getItem(`scafis_period_${companyId}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

const usePeriodStore = create((set, get) => ({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),

  initForCompany: (companyId) => {
    const p = loadPeriod(companyId);
    set({ month: p.month, year: p.year });
  },

  setPeriod: (month, year, companyId) => {
    if (companyId) {
      localStorage.setItem(`scafis_period_${companyId}`, JSON.stringify({ month, year }));
    }
    set({ month, year });
  },

  getLabel: () => {
    const { month, year } = get();
    return `${MONTHS[month - 1]} ${year}`;
  },
}));

export default usePeriodStore;
