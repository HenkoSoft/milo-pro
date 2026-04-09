import { useDeferredValue, useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands, getCategories } from '../../services/catalog';
import { createProduct, deleteProduct, getNextSku, getProducts, updateProduct } from '../../services/products';
import { syncWooProduct } from '../../services/woocommerce';
import type { ProductListParams } from '../../types/product';

export function useProducts(params: ProductListParams) {
  const deferredSearch = useDeferredValue(params.search || '');

  return useQuery({
    queryKey: ['products', deferredSearch, params.category || '', params.lowStock ? 'low' : 'all'],
    queryFn: () =>
      getProducts({
        ...params,
        search: deferredSearch
      }),
    staleTime: 10_000
  });
}

export function useProductFormData() {
  const [categoriesQuery, brandsQuery, nextSkuQuery] = useQueries({
    queries: [
      { queryKey: ['categories'], queryFn: getCategories, staleTime: 60_000 },
      { queryKey: ['brands'], queryFn: getBrands, staleTime: 60_000 },
      { queryKey: ['products', 'next-sku'], queryFn: getNextSku, staleTime: 30_000 }
    ]
  });

  return useMemo(
    () => ({
      categoriesQuery,
      brandsQuery,
      nextSkuQuery
    }),
    [brandsQuery, categoriesQuery, nextSkuQuery]
  );
}

export function useProductMutations() {
  const queryClient = useQueryClient();

  const refreshProducts = async () => {
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: object) => createProduct(payload),
    onSuccess: refreshProducts
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => updateProduct(id, payload),
    onSuccess: refreshProducts
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: refreshProducts
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => syncWooProduct(id),
    onSuccess: refreshProducts
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    syncMutation
  };
}

