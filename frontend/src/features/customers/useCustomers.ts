import { useDeferredValue, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../../api/customers';
import type { CustomerPayload } from '../../types/customer';

export function useCustomers(search: string) {
  const deferredSearch = useDeferredValue(search);

  return useQuery({
    queryKey: ['customers', deferredSearch],
    queryFn: () => getCustomers(deferredSearch),
    staleTime: 10_000
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();

  const refreshCustomers = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: refreshCustomers
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerPayload }) =>
      updateCustomer(id, payload),
    onSuccess: refreshCustomers
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: refreshCustomers
  });

  return useMemo(
    () => ({
      createMutation,
      updateMutation,
      deleteMutation
    }),
    [createMutation, deleteMutation, updateMutation]
  );
}
