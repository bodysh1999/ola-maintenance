import { AlertTriangle, ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react';
import { Badge } from './ui';
import { PRIORITY_TONE, STATUS_TONE, WARRANTY_TONE } from '@/lib/constants';
import type { Dict } from '@/lib/i18n';
import type { Priority, RequestStatus, WarrantyState } from '@/lib/types';

export function StatusBadge({ status, d }: { status: RequestStatus; d: Dict }) {
  return <Badge className={STATUS_TONE[status]}>{d.status[status]}</Badge>;
}

export function PriorityBadge({ priority, d }: { priority: Priority; d: Dict }) {
  return <Badge className={PRIORITY_TONE[priority]}>{d.priority[priority]}</Badge>;
}

export function WarrantyBadge({ state, d }: { state: WarrantyState; d: Dict }) {
  const Icon = state === 'in_warranty' ? ShieldCheck : state === 'out_of_warranty' ? ShieldOff : ShieldQuestion;
  return (
    <Badge className={WARRANTY_TONE[state]}>
      <Icon className="h-3.5 w-3.5" />
      {d.warranty[state]}
    </Badge>
  );
}

export function OverdueBadge({ d }: { d: Dict }) {
  return (
    <Badge className="bg-rose-50 text-rose-700 ring-rose-200">
      <AlertTriangle className="h-3 w-3" />
      {d.common.overdue}
    </Badge>
  );
}
