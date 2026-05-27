import {
  ClockIcon,
  CubeIcon,
  DocumentTextIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import { ComponentType, SVGProps } from 'react';

import { cn } from '~/lib/utils';

const ICONS = {
  notes: DocumentTextIcon,
  interval: ClockIcon,
  rest: PauseIcon,
  complex: CubeIcon,
} as const;

export type WorkoutAddonId = keyof typeof ICONS;

export const WorkoutAddonToggle = ({
  id,
  label,
  isOn,
  onToggle,
}: {
  id: WorkoutAddonId;
  label: string;
  isOn: boolean;
  onToggle: () => void;
}) => {
  const Icon = ICONS[id] as ComponentType<SVGProps<SVGSVGElement>>;

  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={`${label}, ${isOn ? 'on' : 'off'}`}
      onClick={onToggle}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border bg-card px-0.5 py-1.5 transition-colors',
        isOn
          ? 'border-primary/40 bg-secondary ring-1 ring-primary/30'
          : 'border-border',
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0 text-foreground" aria-hidden />
      <span className="text-xs font-semibold leading-tight text-foreground">
        {label}
      </span>
      <span className="text-[10px] leading-tight text-muted-foreground">
        {isOn ? 'on' : 'off'}
      </span>
    </button>
  );
};
