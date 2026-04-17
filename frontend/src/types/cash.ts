export type CashMovementType = 'income' | 'expenses' | 'withdrawals';

export interface CashMovement {
  id: number;
  type: CashMovementType;
  date: string;
  description: string;
  person?: string | null;
  amount: number;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CashMovementPayload {
  type: CashMovementType;
  date: string;
  description: string;
  person: string;
  amount: number;
  notes?: string;
}
