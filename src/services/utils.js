export const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(Number(value || 0));
export const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
export const currentPeriod = () => {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
};
export const periodLabel = period => {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};
export const dateLabel = date => date ? new Intl.DateTimeFormat('tr-TR').format(new Date(`${date}T00:00:00`)) : 'Tarih yok';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
export function movePeriod(period, delta) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}
export function totals(items) {
  const income = items.filter(x => x.type === 'income').reduce((sum, x) => sum + Number(x.amount), 0);
  const expense = items.filter(x => x.type === 'expense').reduce((sum, x) => sum + Number(x.amount), 0);
  const paid = items.filter(x => x.type === 'expense' && x.status === 'paid').reduce((sum, x) => sum + Number(x.amount), 0);
  const unpaid = items.filter(x => x.type === 'expense' && x.status !== 'paid').reduce((sum, x) => sum + Number(x.amount), 0);
  return { income, expense, balance: income - expense, paid, unpaid };
}
