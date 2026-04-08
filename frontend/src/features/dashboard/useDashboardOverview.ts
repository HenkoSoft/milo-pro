import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview } from '../../services/dashboard';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 30_000
  });
}

