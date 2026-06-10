export type DateRangeValidationResult = {
  from: string;
  to: string;
  error: string | null;
};

function normalizeDateInput(rawValue: string, isEndDate: boolean): string {
  const value = rawValue.trim();

  if (/^\d{4}$/.test(value)) {
    return isEndDate ? `${value}-12-31` : `${value}-01-01`;
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    if (!isEndDate) {
      return `${value}-01`;
    }

    const [yearText, monthText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const lastDay = new Date(year, month, 0).getDate();
    return `${value}-${lastDay}`;
  }

  return value;
}

export function validateFlexibleDateRange(fromInput: string, toInput: string): DateRangeValidationResult {
  const from = normalizeDateInput(fromInput, false);
  const to = normalizeDateInput(toInput, true);

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!from || !to) {
    return { from, to, error: 'Ingresa ambas fechas' };
  }

  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return { from, to, error: 'Formato inválido. Use YYYY, YYYY-MM o YYYY-MM-DD' };
  }

  if (new Date(from) > new Date(to)) {
    return { from, to, error: '"Desde" no puede ser posterior a "Hasta"' };
  }

  return { from, to, error: null };
}

export function getRangeDates(days: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (days === -1) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: toISO(yesterday), to: toISO(yesterday) };
  }
  const to = new Date();
  const from = new Date();
  if (days > 0) from.setDate(from.getDate() - days + 1);
  return { from: toISO(from), to: toISO(to) };
}

export function getLocalDateString(dateInput: Date | string | number = new Date()): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  // Avoid NaN issues if invalid date passed
  if (isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
