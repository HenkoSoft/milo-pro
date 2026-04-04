import { apiRequest } from './client';
import type {
  DashboardAlerts,
  DashboardActivityItem,
  DashboardOverview,
  DashboardStats,
  OnlineSaleFeedItem
} from '../types/dashboard';

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [stats, alerts, recentActivity, onlineFeed] = await Promise.all([
    apiRequest<DashboardStats>('/dashboard/stats'),
    apiRequest<DashboardAlerts>('/dashboard/alerts'),
    apiRequest<DashboardActivityItem[]>('/dashboard/recent-activity'),
    apiRequest<OnlineSaleFeedItem[]>('/sales/online-feed')
  ]);

  return {
    stats,
    alerts,
    recentActivity,
    onlineFeed
  };
}
