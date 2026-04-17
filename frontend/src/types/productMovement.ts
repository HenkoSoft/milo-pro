export interface ProductMovement {
  id: string;
  type: 'adjustment' | 'output';
  product_id?: number | null;
  date: string;
  code: string;
  description: string;
  quantity: number;
  reference: string;
}

export interface ProductMovementPayload {
  type: 'adjustment' | 'output';
  product_id?: number | null;
  date: string;
  code: string;
  description: string;
  quantity: number;
  reference: string;
}
