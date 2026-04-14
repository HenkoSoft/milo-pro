type EmitterTaxCondition = 'MONOTRIBUTO' | 'RESPONSABLE_INSCRIPTO' | 'IVA_EXENTO';
type CustomerTaxCondition = 'CONSUMIDOR_FINAL' | 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'IVA_EXENTO';
type VoucherType = 'A' | 'B' | 'C';

export function normalizeEmitterTaxCondition(value: unknown): EmitterTaxCondition | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MONOTRIBUTO' || normalized === 'RESPONSABLE_INSCRIPTO' || normalized === 'IVA_EXENTO') {
    return normalized;
  }
  return null;
}

export function normalizeCustomerTaxCondition(value: unknown): CustomerTaxCondition | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'CONSUMIDOR_FINAL') return normalized;
  if (normalized === 'RESPONSABLE_INSCRIPTO') return normalized;
  if (normalized === 'MONOTRIBUTISTA' || normalized === 'MONOTRIBUTO') return 'MONOTRIBUTO';
  if (normalized === 'EXENTO' || normalized === 'IVA_EXENTO') return 'IVA_EXENTO';
  return null;
}

export function getAvailableVoucherTypes(emitterTaxCondition: unknown, customerTaxCondition: unknown): VoucherType[] {
  const normalizedEmitter = normalizeEmitterTaxCondition(emitterTaxCondition);
  if (!normalizedEmitter) return [];

  if (normalizedEmitter === 'MONOTRIBUTO' || normalizedEmitter === 'IVA_EXENTO') {
    return ['C'];
  }

  return ['A', 'B'];
}

export function getFiscalValidationMessage(emitterTaxCondition: unknown, customerTaxCondition: unknown): string {
  const normalizedEmitter = normalizeEmitterTaxCondition(emitterTaxCondition);
  if (!normalizedEmitter) {
    return 'Completa la condicion fiscal del emisor en Datos Generales para facturar.';
  }

  return '';
}
