import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview } from '../../api/dashboard';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 30_000
  });
}
