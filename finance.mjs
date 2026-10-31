// Calculations are independent of storage and rendering. Dates are calendar dates,
// never browser-local timestamps. XIRR uses ACT/365; projections ACT/365.2425.
const DAY_MS = 86400000;
const PROJECTION_YEAR = 365.2425;
const currencyFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function dateDay(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('La fecha debe tener formato AAAA-MM-DD.');
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('La fecha indicada no es válida.');
  return date.getTime() / DAY_MS;
}

export function todayISO() {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const money = amount => Number.isFinite(amount) ? currencyFormat.format(amount) : '—';
export const percent = rate => Number.isFinite(rate) ? percentFormat.format(rate) : '—';

function sum(values) {
  // Neumaier summation keeps many small contributions alongside large balances.
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

/** Annual money-weighted return for contributions followed by a terminal value.
 * Cash outflows are negative. Earlier positive cash flows are intentionally
 * unsupported: they can create multiple IRRs, which must not be silently chosen.
 */
export function xirr(flows) {
  if (!Array.isArray(flows) || !flows.length) return null;
  const days = new Map();
  try {
    for (const flow of flows) {
      const day = dateDay(flow.date);
      if (!Number.isFinite(flow.amount)) return null;
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(flow.amount);
    }
  } catch { return null; }
  const merged = [...days].map(([day, amounts]) => ({ day, amount: sum(amounts) })).sort((a, b) => a.day - b.day);
  if (merged.length < 2) return null;
  const terminal = merged.at(-1);
  const preceding = merged.slice(0, -1).filter(flow => flow.amount !== 0);
  if (!preceding.length || preceding.some(flow => flow.amount > 0) || terminal.amount < 0) return null;
  if (terminal.amount === 0) return -1;
  const terms = preceding.map(flow => ({ logAmount: Math.log(-flow.amount), years: (terminal.day - flow.day) / 365 }));
  const logTerminal = Math.log(terminal.amount);
  const residual = logRate => {
    const powers = terms.map(term => term.logAmount + term.years * logRate);
    const largest = powers.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
    return largest + Math.log(sum(powers.map(power => Math.exp(power - largest)))) - logTerminal;
  };
  // Solve in log(1+r), retaining stability for losses close to -100% and
  // very high positive returns. This function is strictly increasing here.
  let lo = -1, hi = 1;
  while (residual(lo) > 0 && lo > -1048576) lo *= 2;
  while (residual(hi) < 0 && hi < 1048576) hi *= 2;
  if (residual(lo) > 0 || residual(hi) < 0) return null;
  for (let iteration = 0; iteration < 180; iteration++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) hi = mid; else lo = mid;
  }
  const result = Math.expm1((lo + hi) / 2);
  return Number.isFinite(result) ? result : null;
}

function validRecords(records, kind) {
  if (!Array.isArray(records)) throw new Error('El historial debe ser una lista.');
  return records.map(record => {
    dateDay(record.date);
    if (!Number.isFinite(record.amount) || record.amount < 0 || (kind === 'contribution' && record.amount === 0)) throw new Error('Los importes del historial no son válidos.');
    return { ...record };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function portfolioStats(data) {
  const contributions = validRecords(data.contributions ?? [], 'contribution');
  const valuations = validRecords(data.valuations ?? [], 'valuation');
  const latest = valuations.at(-1) ?? null;
  const contributionsIncluded = latest ? contributions.filter(item => item.date <= latest.date) : [];
  const contributionsPending = latest ? contributions.filter(item => item.date > latest.date) : contributions;
  const totalContributed = sum(contributionsIncluded.map(item => item.amount));
  const totalAllContributed = sum(contributions.map(item => item.amount));
  const pendingAmount = sum(contributionsPending.map(item => item.amount));
  const gain = latest && totalContributed > 0 ? latest.amount - totalContributed : null;
  const simpleReturn = totalContributed > 0 && latest ? gain / totalContributed : null;
  const days = latest && contributionsIncluded.length ? dateDay(latest.date) - dateDay(contributionsIncluded[0].date) : 0;
  const annualized = latest && contributionsIncluded.length ? xirr([
    ...contributionsIncluded.map(item => ({ date: item.date, amount: -item.amount })),
    { date: latest.date, amount: latest.amount },
  ]) : null;
  // Both lists are sorted: walk contributions once instead of rescanning the
  // entire history for each valuation. Keep compensated cumulative sums.
  let contributionIndex = 0, investedTotal = 0, investedCorrection = 0;
  const series = valuations.map(valuation => {
    while (contributionIndex < contributions.length && contributions[contributionIndex].date <= valuation.date) {
      const amount = contributions[contributionIndex++].amount;
      const next = investedTotal + amount;
      investedCorrection += Math.abs(investedTotal) >= Math.abs(amount) ? (investedTotal - next) + amount : (amount - next) + investedTotal;
      investedTotal = next;
    }
    return { date: valuation.date, value: valuation.amount, invested: investedTotal + investedCorrection };
  });
  return { latest, contributionsIncluded, contributionsPending, totalContributed, totalAllContributed, pendingAmount, gain, simpleReturn, annualized, days, series };
}

function monthAt(anchorISO, offset) {
  const [year, month, day] = anchorISO.split('-').map(Number);
  const monthIndex = year * 12 + month - 1 + offset;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const last = new Date(0);
  last.setUTCFullYear(targetYear, targetMonth + 1, 0);
  last.setUTCHours(0, 0, 0, 0);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, last.getUTCDate())).padStart(2, '0')}`;
}

/** Effective annual return, monthly contributions on exact calendar dates.
 * When firstContributionDate is supplied, its day anchors every contribution.
 * Otherwise dates remain anchored to startDate (31 Jan -> 28 Feb -> 31 Mar).
 * A contribution on the target date is included, earning no interest that day.
 */
export function project({ initial, monthly, annualRate, startDate, endDate, timing = 'end', firstContributionDate }) {
  if (![initial, monthly].every(value => Number.isFinite(value) && value >= 0 && value <= 1e9)) throw new Error('El capital y la aportación deben estar entre 0 y 1.000.000.000 €.');
  if (!Number.isFinite(annualRate) || annualRate < -0.999 || annualRate > 1) throw new Error('La rentabilidad anual debe estar entre −99,9 % y 100 %.');
  const start = dateDay(startDate), end = dateDay(endDate);
  if (end < start) throw new Error('La fecha objetivo no puede ser anterior a la fecha de inicio.');
  const horizon = monthAt(startDate, 960);
  if (horizon.length === 10 && endDate > horizon) throw new Error('El plazo máximo de simulación es de 80 años.');
  if (timing !== 'end' && timing !== 'start') throw new Error('El momento de la aportación no es válido.');
  if (firstContributionDate !== undefined && firstContributionDate !== null && firstContributionDate !== '') {
    if (dateDay(firstContributionDate) < start) throw new Error('La primera aportación no puede ser anterior al inicio.');
  }
  const customFirst = Boolean(firstContributionDate);
  const anchor = customFirst ? firstContributionDate : startDate;
  const firstOffset = customFirst || timing === 'start' ? 0 : 1;
  const schedule = [];
  for (let offset = firstOffset; offset <= 961; offset++) {
    const date = monthAt(anchor, offset);
    if (date.length !== 10 || date > endDate) break;
    if (date >= startDate) schedule.push({ date, amount: monthly });
  }
  const dates = [...new Set([startDate, ...schedule.map(item => item.date), endDate])].sort();
  const logGrowth = Math.log1p(annualRate) / PROJECTION_YEAR;
  let value = initial, contributed = initial, previousDay = start;
  let nextContribution = 0;
  const points = dates.map(date => {
    const day = dateDay(date);
    value *= Math.exp(logGrowth * (day - previousDay));
    while (nextContribution < schedule.length && schedule[nextContribution].date === date) {
      value += monthly;
      contributed += monthly;
      nextContribution++;
    }
    previousDay = day;
    return { date, value, contributed };
  });
  if (!Number.isFinite(value)) throw new Error('El resultado supera el límite de cálculo. Reduce el plazo o la rentabilidad.');
  return { value, contributed, gain: value - contributed, months: schedule.length, points, schedule };
}
