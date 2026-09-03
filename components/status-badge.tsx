import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'warning' | 'success';

const statusMap: Record<string, StatusVariant> = {
  SCHEDULED: 'default',
  IN_PROGRESS: 'secondary',
  PAUSED: 'warning',
  DRAFT: 'outline',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  OPEN: 'destructive',
  RESOLVED: 'success',
  ACTIVE: 'success',
  INACTIVE: 'outline',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.replace(/\s+/g, '_').toUpperCase();
  const variant = statusMap[normalized] || 'outline';
  return <Badge variant={variant} className={cn('capitalize', className)}>{status.toLowerCase().replace(/_/g, ' ')}</Badge>;
}
