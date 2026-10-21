'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useI18n } from './client';
import { STATUS_HEX } from '@/lib/constants';
import type { Category, RequestStatus } from '@/lib/types';

const BRAND = 'rgb(var(--brand))';
const ACCENT = 'rgb(var(--accent))';
const tooltipStyle = { borderRadius: 12, border: '1px solid #E4DFEA', fontSize: 12, fontFamily: 'inherit' };

export function CategoryBars({ data }: { data: { key: Category; count: number }[] }) {
  const { d, locale } = useI18n();
  const rows = data.map((x) => ({ name: d.category[x.key], count: x.count }));
  if (!rows.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#EFECF3" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#7F7889' }} axisLine={false} tickLine={false} reversed={locale === 'ar'} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#1E1828' }} axisLine={false} tickLine={false} orientation={locale === 'ar' ? 'right' : 'left'} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#EFECF3' }} />
        <Bar dataKey="count" name={d.admin.reports.count} fill={BRAND} radius={[6, 6, 6, 6]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyArea({ data }: { data: { day: string; created: number; completed: number }[] }) {
  const { d, locale } = useI18n();
  const rows = data.map((x) => ({ ...x, label: x.day.slice(5).replace('-', '/') }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EFECF3" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7F7889' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} reversed={locale === 'ar'} />
        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: '#7F7889' }} axisLine={false} tickLine={false} orientation={locale === 'ar' ? 'right' : 'left'} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="created" name={d.admin.created} stroke={BRAND} strokeWidth={2} fill="url(#gCreated)" />
        <Area type="monotone" dataKey="completed" name={d.admin.closed} stroke={ACCENT} strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data: { key: RequestStatus; count: number }[] }) {
  const { d } = useI18n();
  const total = data.reduce((s, x) => s + x.count, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="key" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((x) => <Cell key={x.key} fill={STATUS_HEX[x.key]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v as number, d.status[n as RequestStatus]]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><div className="text-2xl font-semibold">{total}</div><div className="text-[11px] text-stone-450">{d.common.total}</div></div>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {data.map((x) => (
          <li key={x.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_HEX[x.key] }} />{d.status[x.key]}</span>
            <span className="font-medium tabular-nums">{x.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimpleBars({ data, color = 'accent' }: { data: { key: string; count: number }[]; color?: 'brand' | 'accent' }) {
  const { d, locale } = useI18n();
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide reversed={locale === 'ar'} />
        <YAxis type="category" dataKey="key" width={130} tick={{ fontSize: 12, fill: '#1E1828' }} axisLine={false} tickLine={false} orientation={locale === 'ar' ? 'right' : 'left'} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#EFECF3' }} />
        <Bar dataKey="count" name={d.admin.reports.count} fill={color === 'brand' ? BRAND : ACCENT} radius={6} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  const { d } = useI18n();
  return <div className="grid h-40 place-items-center text-sm text-stone-450">{d.common.noData}</div>;
}
