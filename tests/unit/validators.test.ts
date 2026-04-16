import { describe, it, expect } from 'vitest';

import {
  loginSchema,
  createUserSchema,
  passwordSchema,
  validatePassword,
} from '@/lib/validators/auth';
import {
  createProductSchema,
  updateProductSchema,
  variantSchema,
} from '@/lib/validators/product';
import {
  confirmSaleSchema,
  voidSaleSchema,
  saleLineSchema,
  paymentSchema,
} from '@/lib/validators/sale';
import {
  stockAdjustmentSchema,
  transferSchema,
  alertAcknowledgeSchema,
} from '@/lib/validators/inventory';
import {
  processReturnSchema,
  returnLineSchema,
} from '@/lib/validators/return';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID2 = '660e8400-e29b-41d4-a716-446655440001';

function expectSuccess(result: { success: boolean }) {
  expect(result.success).toBe(true);
}

function expectFailure(result: { success: boolean }) {
  expect(result.success).toBe(false);
}

// ─── Auth validators ─────────────────────────────────────────────────────────

describe('auth validators', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      expectSuccess(loginSchema.safeParse({ email: 'user@example.com', password: 'secret' }));
    });

    it('rejects invalid email', () => {
      expectFailure(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }));
    });

    it('rejects empty password', () => {
      expectFailure(loginSchema.safeParse({ email: 'user@example.com', password: '' }));
    });
  });

  describe('passwordSchema', () => {
    it('accepts a strong password', () => {
      expectSuccess(passwordSchema.safeParse('Str0ng!Pass'));
    });

    it('rejects password shorter than 8 chars', () => {
      expectFailure(passwordSchema.safeParse('Ab1!'));
    });

    it('rejects password without uppercase', () => {
      expectFailure(passwordSchema.safeParse('abcdefg1!'));
    });

    it('rejects password without lowercase', () => {
      expectFailure(passwordSchema.safeParse('ABCDEFG1!'));
    });

    it('rejects password without digit', () => {
      expectFailure(passwordSchema.safeParse('Abcdefgh!'));
    });

    it('rejects password without special char', () => {
      expectFailure(passwordSchema.safeParse('Abcdefg1'));
    });
  });

  describe('validatePassword', () => {
    it('returns true for a valid password', () => {
      expect(validatePassword('Str0ng!Pass')).toBe(true);
    });

    it('returns false for a short password', () => {
      expect(validatePassword('Ab1!')).toBe(false);
    });

    it('returns false for missing uppercase', () => {
      expect(validatePassword('abcdefg1!')).toBe(false);
    });

    it('returns false for missing special char', () => {
      expect(validatePassword('Abcdefg1')).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    const valid = {
      full_name: 'Carlos Admin',
      email: 'carlos@example.com',
      role: 'admin' as const,
      store_ids: [UUID],
    };

    it('accepts valid user data', () => {
      expectSuccess(createUserSchema.safeParse(valid));
    });

    it('rejects empty full_name', () => {
      expectFailure(createUserSchema.safeParse({ ...valid, full_name: '' }));
    });

    it('rejects invalid role', () => {
      expectFailure(createUserSchema.safeParse({ ...valid, role: 'superadmin' }));
    });

    it('rejects empty store_ids', () => {
      expectFailure(createUserSchema.safeParse({ ...valid, store_ids: [] }));
    });

    it('rejects invalid UUID in store_ids', () => {
      expectFailure(createUserSchema.safeParse({ ...valid, store_ids: ['not-a-uuid'] }));
    });
  });
});

// ─── Product validators ──────────────────────────────────────────────────────

describe('product validators', () => {
  const validVariant = { size_id: UUID, color_id: UUID };

  const validProduct = {
    name: 'Zapato Oxford Classic',
    brand_id: UUID,
    category_id: UUID,
    base_price: 1200,
    cost: 600,
    tax_rate: 0.16,
    variants: [validVariant],
  };

  describe('variantSchema', () => {
    it('accepts a variant without optional fields', () => {
      expectSuccess(variantSchema.safeParse(validVariant));
    });

    it('accepts a variant with valid EAN-13 barcode', () => {
      expectSuccess(variantSchema.safeParse({ ...validVariant, barcode: '4006381333931' }));
    });

    it('rejects an invalid EAN-13 barcode', () => {
      expectFailure(variantSchema.safeParse({ ...validVariant, barcode: '1234567890123' }));
    });

    it('rejects a barcode that is not 13 digits', () => {
      expectFailure(variantSchema.safeParse({ ...validVariant, barcode: '12345' }));
    });

    it('accepts a variant with price_override', () => {
      expectSuccess(variantSchema.safeParse({ ...validVariant, price_override: 1300 }));
    });

    it('rejects negative price_override', () => {
      expectFailure(variantSchema.safeParse({ ...validVariant, price_override: -10 }));
    });
  });

  describe('createProductSchema', () => {
    it('accepts a valid product', () => {
      expectSuccess(createProductSchema.safeParse(validProduct));
    });

    it('rejects name exceeding 200 chars', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, name: 'A'.repeat(201) }));
    });

    it('rejects description exceeding 5000 chars', () => {
      expectFailure(
        createProductSchema.safeParse({ ...validProduct, description: 'A'.repeat(5001) }),
      );
    });

    it('rejects negative base_price', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, base_price: -1 }));
    });

    it('rejects negative cost', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, cost: -1 }));
    });

    it('rejects tax_rate above 1', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, tax_rate: 1.5 }));
    });

    it('rejects tax_rate below 0', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, tax_rate: -0.1 }));
    });

    it('rejects empty variants array', () => {
      expectFailure(createProductSchema.safeParse({ ...validProduct, variants: [] }));
    });
  });

  describe('updateProductSchema', () => {
    it('accepts partial updates', () => {
      expectSuccess(updateProductSchema.safeParse({ name: 'New Name' }));
    });

    it('accepts empty object', () => {
      expectSuccess(updateProductSchema.safeParse({}));
    });
  });
});

// ─── Sale validators ─────────────────────────────────────────────────────────

describe('sale validators', () => {
  const validLine = { variant_id: UUID, quantity: 2, unit_price: 1200 };
  const validPayment = { payment_method_id: UUID, amount: 2784 };

  const validSale = {
    store_id: UUID,
    lines: [validLine],
    payments: [validPayment],
  };

  describe('saleLineSchema', () => {
    it('accepts a valid sale line', () => {
      expectSuccess(saleLineSchema.safeParse(validLine));
    });

    it('rejects quantity of 0', () => {
      expectFailure(saleLineSchema.safeParse({ ...validLine, quantity: 0 }));
    });

    it('rejects negative unit_price', () => {
      expectFailure(saleLineSchema.safeParse({ ...validLine, unit_price: -1 }));
    });

    it('rejects non-integer quantity', () => {
      expectFailure(saleLineSchema.safeParse({ ...validLine, quantity: 1.5 }));
    });
  });

  describe('paymentSchema', () => {
    it('accepts a valid payment', () => {
      expectSuccess(paymentSchema.safeParse(validPayment));
    });

    it('rejects negative amount', () => {
      expectFailure(paymentSchema.safeParse({ ...validPayment, amount: -100 }));
    });
  });

  describe('confirmSaleSchema', () => {
    it('accepts a valid sale', () => {
      expectSuccess(confirmSaleSchema.safeParse(validSale));
    });

    it('rejects empty lines', () => {
      expectFailure(confirmSaleSchema.safeParse({ ...validSale, lines: [] }));
    });

    it('rejects empty payments', () => {
      expectFailure(confirmSaleSchema.safeParse({ ...validSale, payments: [] }));
    });

    it('accepts sale with discount', () => {
      expectSuccess(
        confirmSaleSchema.safeParse({
          ...validSale,
          discount: { type: 'percentage', value: 10 },
        }),
      );
    });
  });

  describe('voidSaleSchema', () => {
    it('accepts valid void request', () => {
      expectSuccess(voidSaleSchema.safeParse({ sale_id: UUID, reason: 'Error del vendedor' }));
    });

    it('rejects empty reason', () => {
      expectFailure(voidSaleSchema.safeParse({ sale_id: UUID, reason: '' }));
    });

    it('rejects reason exceeding 500 chars', () => {
      expectFailure(voidSaleSchema.safeParse({ sale_id: UUID, reason: 'A'.repeat(501) }));
    });
  });
});

// ─── Inventory validators ────────────────────────────────────────────────────

describe('inventory validators', () => {
  describe('stockAdjustmentSchema', () => {
    const valid = {
      variant_id: UUID,
      store_id: UUID,
      new_quantity: 8,
      reason: 'physical_count',
      note: 'Conteo realizado el 15/03/2024',
    };

    it('accepts a valid adjustment', () => {
      expectSuccess(stockAdjustmentSchema.safeParse(valid));
    });

    it('rejects negative new_quantity', () => {
      expectFailure(stockAdjustmentSchema.safeParse({ ...valid, new_quantity: -1 }));
    });

    it('rejects non-integer new_quantity', () => {
      expectFailure(stockAdjustmentSchema.safeParse({ ...valid, new_quantity: 8.5 }));
    });

    it('rejects invalid reason', () => {
      expectFailure(stockAdjustmentSchema.safeParse({ ...valid, reason: 'invalid_reason' }));
    });

    it('rejects empty note', () => {
      expectFailure(stockAdjustmentSchema.safeParse({ ...valid, note: '' }));
    });

    it('accepts all valid adjustment reasons', () => {
      const reasons = ['physical_count', 'damage', 'theft_loss', 'system_error', 'other'];
      for (const reason of reasons) {
        expectSuccess(stockAdjustmentSchema.safeParse({ ...valid, reason }));
      }
    });
  });

  describe('transferSchema', () => {
    const valid = {
      source_store_id: UUID,
      destination_store_id: UUID2,
      lines: [{ variant_id: UUID, quantity: 2 }],
    };

    it('accepts a valid transfer', () => {
      expectSuccess(transferSchema.safeParse(valid));
    });

    it('rejects same source and destination', () => {
      expectFailure(
        transferSchema.safeParse({ ...valid, destination_store_id: UUID }),
      );
    });

    it('rejects empty lines', () => {
      expectFailure(transferSchema.safeParse({ ...valid, lines: [] }));
    });

    it('rejects line with quantity 0', () => {
      expectFailure(
        transferSchema.safeParse({
          ...valid,
          lines: [{ variant_id: UUID, quantity: 0 }],
        }),
      );
    });

    it('accepts transfer with optional note', () => {
      expectSuccess(transferSchema.safeParse({ ...valid, note: 'Solicitud de gerente' }));
    });
  });

  describe('alertAcknowledgeSchema', () => {
    it('accepts empty object', () => {
      expectSuccess(alertAcknowledgeSchema.safeParse({}));
    });

    it('accepts with optional note', () => {
      expectSuccess(alertAcknowledgeSchema.safeParse({ note: 'Pedido realizado' }));
    });

    it('rejects note exceeding 1000 chars', () => {
      expectFailure(alertAcknowledgeSchema.safeParse({ note: 'A'.repeat(1001) }));
    });
  });
});

// ─── Return validators ───────────────────────────────────────────────────────

describe('return validators', () => {
  const validReturnLine = {
    sale_line_id: UUID,
    variant_id: UUID,
    quantity: 1,
  };

  const validReturn = {
    original_sale_id: UUID,
    store_id: UUID,
    reason: 'factory_defect',
    lines: [validReturnLine],
  };

  describe('returnLineSchema', () => {
    it('accepts a valid return line', () => {
      expectSuccess(returnLineSchema.safeParse(validReturnLine));
    });

    it('rejects quantity of 0', () => {
      expectFailure(returnLineSchema.safeParse({ ...validReturnLine, quantity: 0 }));
    });

    it('rejects negative quantity', () => {
      expectFailure(returnLineSchema.safeParse({ ...validReturnLine, quantity: -1 }));
    });

    it('rejects non-integer quantity', () => {
      expectFailure(returnLineSchema.safeParse({ ...validReturnLine, quantity: 1.5 }));
    });

    it('rejects invalid sale_line_id', () => {
      expectFailure(returnLineSchema.safeParse({ ...validReturnLine, sale_line_id: 'not-uuid' }));
    });

    it('rejects invalid variant_id', () => {
      expectFailure(returnLineSchema.safeParse({ ...validReturnLine, variant_id: 'not-uuid' }));
    });
  });

  describe('processReturnSchema', () => {
    it('accepts a valid return', () => {
      expectSuccess(processReturnSchema.safeParse(validReturn));
    });

    it('accepts a return with reason_note', () => {
      expectSuccess(
        processReturnSchema.safeParse({
          ...validReturn,
          reason_note: 'Suela despegada después de 3 días',
        }),
      );
    });

    it('accepts a return with null reason_note', () => {
      expectSuccess(
        processReturnSchema.safeParse({ ...validReturn, reason_note: null }),
      );
    });

    it('rejects empty lines', () => {
      expectFailure(processReturnSchema.safeParse({ ...validReturn, lines: [] }));
    });

    it('rejects invalid reason', () => {
      expectFailure(
        processReturnSchema.safeParse({ ...validReturn, reason: 'invalid_reason' }),
      );
    });

    it('rejects invalid original_sale_id', () => {
      expectFailure(
        processReturnSchema.safeParse({ ...validReturn, original_sale_id: 'not-uuid' }),
      );
    });

    it('rejects reason_note exceeding 1000 chars', () => {
      expectFailure(
        processReturnSchema.safeParse({ ...validReturn, reason_note: 'A'.repeat(1001) }),
      );
    });

    it('accepts all valid return reasons', () => {
      const reasons = ['factory_defect', 'wrong_size', 'not_satisfied', 'transport_damage', 'other'];
      for (const reason of reasons) {
        expectSuccess(processReturnSchema.safeParse({ ...validReturn, reason }));
      }
    });

    it('accepts multiple return lines', () => {
      expectSuccess(
        processReturnSchema.safeParse({
          ...validReturn,
          lines: [
            validReturnLine,
            { sale_line_id: UUID2, variant_id: UUID2, quantity: 2 },
          ],
        }),
      );
    });
  });
});
