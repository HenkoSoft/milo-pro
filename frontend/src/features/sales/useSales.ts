import { useDeferredValue, useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomers } from '../../api/customers';
import { getProducts } from '../../api/products';
import { createSale, getNextReceiptNumber, getOnlineFeed, getSaleById, getSales, getTodaySales, updateSaleStatus } from '../../api/sales';
import type { SalePayload, SaleStatusUpdatePayload } from '../../types/sale';

export function useSalesHistory(params: { startDate?: string; endDate?: string; customerId?: string }) {
  return useQuery({
    queryKey: ['sales', params.startDate || '', params.endDate || '', params.customerId || ''],
    queryFn: () => getSales(params),
    staleTime: 10_000
  });
}

export function useTodaySales() {
  return useQuery({
    queryKey: ['sales', 'today'],
    queryFn: getTodaySales,
    staleTime: 10_000
  });
}

export function useOnlineFeed(search = '') {
  const deferredSearch = useDeferredValue(search);

  return useQuery({
    queryKey: ['sales', 'online-feed', deferredSearch],
    queryFn: async () => {
      const feed = await getOnlineFeed();
      const normalized = deferredSearch.trim().toLowerCase();
      if (!normalized) return feed;
      return feed.filter((sale) => {
        const haystack = [sale.customer_name, sale.notes, sale.channel, sale.status, sale.receipt_type]
          .map((value) => String(value || '').toLowerCase());
        return haystack.some((value) => value.includes(normalized));
      });
    },
    staleTime: 10_000
  });
}

export function useSaleDetail(id: number | null) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSaleById(Number(id)),
    enabled: Boolean(id)
  });
}

export function useSaleComposerData(receiptType: string, pointOfSale: string) {
  const [productsQuery, customersQuery, nextNumberQuery] = useQueries({
    queries: [
      { queryKey: ['products', 'sale-composer'], queryFn: () => getProducts({}), staleTime: 30_000 },
      { queryKey: ['customers', 'sale-composer'], queryFn: () => getCustomers(''), staleTime: 30_000 },
      {
        queryKey: ['sales', 'next-number', receiptType, pointOfSale],
        queryFn: () => getNextReceiptNumber({ receiptType, pointOfSale }),
        staleTime: 5_000
      }
    ]
  });

  return useMemo(
    () => ({
      productsQuery,
      customersQuery,
      nextNumberQuery
    }),
    [customersQuery, nextNumberQuery, productsQuery]
  );
}

export function useSaleMutations() {
  const queryClient = useQueryClient();

  const refreshSales = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  return {
    createMutation: useMutation({
      mutationFn: (payload: SalePayload) => createSale(payload),
      onSuccess: refreshSales
    }),
    updateStatusMutation: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: SaleStatusUpdatePayload }) => updateSaleStatus(id, payload),
      onSuccess: refreshSales
    })
  };
}
