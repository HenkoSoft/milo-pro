import { useDeferredValue } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands, getDeviceModels, getDeviceTypes } from '../../services/catalog';
import { getCustomers } from '../../services/customers';
import { createRepair, deleteRepair, getRepairById, getRepairs, getRepairStats, updateRepair, updateRepairStatus } from '../../services/repairs';

export function useRepairs(params: { status?: string; search?: string }) {
  const deferredSearch = useDeferredValue(params.search || '');

  return useQuery({
    queryKey: ['repairs', params.status || 'all', deferredSearch],
    queryFn: () => getRepairs({ ...params, search: deferredSearch }),
    staleTime: 10_000
  });
}

export function useRepairStats() {
  return useQuery({
    queryKey: ['repairs', 'stats'],
    queryFn: getRepairStats,
    staleTime: 30_000
  });
}

export function useRepairFormData() {
  const [customersQuery, deviceTypesQuery, brandsQuery, modelsQuery] = useQueries({
    queries: [
      { queryKey: ['customers', 'repair-form'], queryFn: () => getCustomers(''), staleTime: 30_000 },
      { queryKey: ['device-types'], queryFn: getDeviceTypes, staleTime: 60_000 },
      { queryKey: ['brands'], queryFn: getBrands, staleTime: 60_000 },
      { queryKey: ['device-models'], queryFn: () => getDeviceModels(''), staleTime: 60_000 }
    ]
  });

  return {
    customersQuery,
    deviceTypesQuery,
    brandsQuery,
    modelsQuery
  };
}

export function useRepairDetail(id: number | null) {
  return useQuery({
    queryKey: ['repair', id],
    queryFn: () => getRepairById(Number(id)),
    enabled: Boolean(id)
  });
}

export function useRepairMutations() {
  const queryClient = useQueryClient();

  const refreshRepairs = async () => {
    await queryClient.invalidateQueries({ queryKey: ['repairs'] });
  };

  return {
    createMutation: useMutation({
      mutationFn: (payload: object) => createRepair(payload),
      onSuccess: refreshRepairs
    }),
    updateMutation: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: object }) => updateRepair(id, payload),
      onSuccess: refreshRepairs
    }),
    updateStatusMutation: useMutation({
      mutationFn: ({ id, status, notes }: { id: number; status: string; notes: string }) => updateRepairStatus(id, status, notes),
      onSuccess: refreshRepairs
    }),
    deleteMutation: useMutation({
      mutationFn: (id: number) => deleteRepair(id),
      onSuccess: refreshRepairs
    })
  };
}

