import {
  ArrowUpDown, DoorOpen, Droplets, Grid3x3, PaintRoller, Refrigerator, Snowflake, Umbrella, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '@/lib/types';

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  electrical: Zap,
  plumbing: Droplets,
  hvac: Snowflake,
  elevators: ArrowUpDown,
  tiles: Grid3x3,
  painting: PaintRoller,
  doors_windows: DoorOpen,
  insulation: Umbrella,
  appliances: Refrigerator,
  other: Wrench,
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Wrench;
  return <Icon className={className ?? 'h-4 w-4'} />;
}
