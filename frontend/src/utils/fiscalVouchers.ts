import type { EmitterTaxCondition } from '../types/settings';

export type VoucherType = 'A' | 'B' | 'C';
export type CustomerTaxCondition = 'CONSUMIDOR_FINAL' | 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'IVA_EXENTO';

function normalizeEmitterTaxCondition(value: string | null | undefined): EmitterTaxCondition | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MONOTRIBUTO' || normalized === 'RESPONSABLE_INSCRIPTO' || normalized === 'IVA_EXENTO') {
    return normalized;
  }
  return null;
}

function normalizeCustomerTaxCondition(value: string | null | undefined): CustomerTaxCondition | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'CONSUMIDOR_FINAL') return normalized;
  if (normalized === 'RESPONSABLE_INSCRIPTO') return normalized;
  if (normalized === 'MONOTRIBUTISTA' || normalized === 'MONOTRIBUTO') return 'MONOTRIBUTO';
  if (normalized === 'EXENTO' || normalized === 'IVA_EXENTO') return 'IVA_EXENTO';
  return null;
}

export function getAvailableVoucherTypes(
  emitterTaxCondition: string | null | undefined,
  customerTaxCondition: string | null | undefined
): VoucherType[] {
  const normalizedEmitter = normalizeEmitterTaxCondition(emitterTaxCondition);
  if (!normalizedEmitter) return [];

  if (normalizedEmitter === 'MONOTRIBUTO' || normalizedEmitter === 'IVA_EXENTO') {
    return ['C'];
  }

  return ['A', 'B'];
}

export function getDefaultVoucherType(
  emitterTaxCondition: string | null | undefined,
  customerTaxCondition: string | null | undefined
): VoucherType | null {
  const normalizedEmitter = normalizeEmitterTaxCondition(emitterTaxCondition);
  if (!normalizedEmitter) return null;
  if (normalizedEmitter === 'MONOTRIBUTO' || normalizedEmitter === 'IVA_EXENTO') return 'C';
  return 'A';
}

export function getFiscalVoucherValidationMessage(
  emitterTaxCondition: string | null | undefined,
  customerTaxCondition: string | null | undefined
): string {
  const normalizedEmitter = normalizeEmitterTaxCondition(emitterTaxCondition);
  if (!normalizedEmitter) {
    return 'Completa la condicion fiscal del emisor en Datos Generales para facturar.';
  }

  return '';
}
