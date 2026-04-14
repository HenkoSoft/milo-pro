export function parseLocaleNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/[^\d,.-]/g, '');
  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);

  if (separatorIndex === -1) {
    const integerOnly = sanitized.replace(/[^\d-]/g, '');
    const parsed = Number.parseFloat(integerOnly);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const integerPart = sanitized.slice(0, separatorIndex).replace(/[^\d-]/g, '');
  const decimalPart = sanitized.slice(separatorIndex + 1).replace(/[^\d]/g, '');
  const normalized = `${integerPart || '0'}.${decimalPart}`;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatLocaleMoneyInput(value: string | number | null | undefined) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseLocaleNumber(value));
}

export function formatLocalePercentInput(value: string | number | null | undefined) {
  const normalized = Math.min(100, Math.max(0, parseLocaleNumber(value)));
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  }).format(normalized);
}

export function isMoneyField(input: HTMLInputElement) {
  const fieldRef = `${input.name} ${input.id} ${input.className}`.toLowerCase();
  return /(price|cost|amount|subtotal|total|cashreceived|cash_received|payment)/.test(fieldRef) || input.dataset.money === 'true';
}

export function isDiscountField(input: HTMLInputElement) {
  const fieldRef = `${input.name} ${input.id} ${input.className}`.toLowerCase();
  return /(discount|descuento|globaldiscount)/.test(fieldRef) || input.dataset.discount === 'true';
}
