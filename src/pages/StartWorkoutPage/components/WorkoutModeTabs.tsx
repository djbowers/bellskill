import {
  ArrowPathIcon,
  CubeIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { ComponentType, SVGProps } from 'react';

import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { WorkoutMode } from '~/types';
import { WORKOUT_MODE_LABELS } from '~/utils';

interface WorkoutModeTabsProps {
  value: WorkoutMode;
  onValueChange: (value: WorkoutMode) => void;
  className?: string;
}

const MODES: WorkoutMode[] = ['circuit', 'straightSets', 'complex'];

const ICONS: Record<WorkoutMode, ComponentType<SVGProps<SVGSVGElement>>> = {
  circuit: ArrowPathIcon,
  straightSets: QueueListIcon,
  complex: CubeIcon,
};

/**
 * The three workout arrangements, as one always-on segmented control. Circuit
 * used to be the unnamed "neither toggle is lit" state; naming it is the point.
 */
export const WorkoutModeTabs = ({
  value,
  onValueChange,
  className,
}: WorkoutModeTabsProps) => (
  <Tabs
    value={value}
    onValueChange={(next) => onValueChange(next as WorkoutMode)}
    className={cn('w-full', className)}
  >
    <TabsList className="flex w-full">
      {MODES.map((mode) => {
        const Icon = ICONS[mode];
        return (
          <TabsTrigger
            key={mode}
            className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1"
            size="sm"
            value={mode}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="truncate leading-none">
              {WORKOUT_MODE_LABELS[mode]}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  </Tabs>
);
