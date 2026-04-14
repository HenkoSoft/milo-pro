import { describe, expect, it } from 'vitest';
import { getAvailableVoucherTypes, getDefaultVoucherType, getFiscalVoucherValidationMessage } from './fiscalVouchers';

describe('fiscalVouchers', () => {
  it('resuelve C para monotributo y exento', () => {
    expect(getAvailableVoucherTypes('MONOTRIBUTO', 'RESPONSABLE_INSCRIPTO')).toEqual(['C']);
    expect(getAvailableVoucherTypes('IVA_EXENTO', 'Consumidor Final')).toEqual(['C']);
  });

  it('resuelve A y B para responsable inscripto', () => {
    expect(getAvailableVoucherTypes('RESPONSABLE_INSCRIPTO', 'Responsable Inscripto')).toEqual(['A', 'B']);
    expect(getAvailableVoucherTypes('RESPONSABLE_INSCRIPTO', 'Consumidor Final')).toEqual(['A', 'B']);
    expect(getAvailableVoucherTypes('RESPONSABLE_INSCRIPTO', 'Monotributista')).toEqual(['A', 'B']);
    expect(getAvailableVoucherTypes('RESPONSABLE_INSCRIPTO', 'Exento')).toEqual(['A', 'B']);
  });

  it('devuelve el comprobante por defecto y valida faltantes', () => {
    expect(getDefaultVoucherType('RESPONSABLE_INSCRIPTO', 'Responsable Inscripto')).toBe('A');
    expect(getDefaultVoucherType('RESPONSABLE_INSCRIPTO', 'Consumidor Final')).toBe('A');
    expect(getDefaultVoucherType('MONOTRIBUTO', 'Consumidor Final')).toBe('C');
    expect(getFiscalVoucherValidationMessage('', 'Consumidor Final')).toContain('emisor');
    expect(getFiscalVoucherValidationMessage('RESPONSABLE_INSCRIPTO', '')).toBe('');
  });
});
