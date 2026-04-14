export type EmitterTaxCondition = 'MONOTRIBUTO' | 'RESPONSABLE_INSCRIPTO' | 'IVA_EXENTO';

export interface BusinessSettingsDto {
  id?: number;
  business_name?: string | null;
  business_address?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  emitter_tax_condition?: EmitterTaxCondition | null;
  updated_at?: string;
}
