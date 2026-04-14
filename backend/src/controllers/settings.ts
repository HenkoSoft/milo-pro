import type { BusinessSettingsDto } from '@shared/types/settings';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeEmitterTaxCondition(value: unknown): BusinessSettingsDto['emitter_tax_condition'] {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MONOTRIBUTO' || normalized === 'RESPONSABLE_INSCRIPTO' || normalized === 'IVA_EXENTO') {
    return normalized;
  }
  return null;
}

export function normalizeSettingsPayload(body: unknown): BusinessSettingsDto {
  const data = isRecord(body) ? body : {};

  return {
    business_name: String(data.business_name || 'Milo Pro').trim() || 'Milo Pro',
    business_address: data.business_address ? String(data.business_address).trim() : null,
    business_phone: data.business_phone ? String(data.business_phone).trim() : null,
    business_email: data.business_email ? String(data.business_email).trim() : null,
    emitter_tax_condition: normalizeEmitterTaxCondition(data.emitter_tax_condition)
  };
}

export function withDefaultSettings(settings: BusinessSettingsDto | null | undefined): BusinessSettingsDto {
  if (!settings) {
    return { business_name: 'Milo Pro' };
  }

  return {
    ...settings,
    business_name: settings.business_name || 'Milo Pro',
    emitter_tax_condition: normalizeEmitterTaxCondition(settings.emitter_tax_condition)
  };
}
