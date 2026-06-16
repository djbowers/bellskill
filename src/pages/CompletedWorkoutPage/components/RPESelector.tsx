import { RadioGroup } from '@headlessui/react';
import clsx from 'clsx';

import { Badge } from '~/components/ui/badge';
import { RpeOptions, WorkoutLog } from '~/types';

export interface RPESelectorProps {
  onSelectRPE: (selectedRPE: WorkoutLog['rpe']) => void;
  rpeValue: WorkoutLog['rpe'];
}

export const RPESelector = ({ onSelectRPE, rpeValue }: RPESelectorProps) => {
  return (
    <RadioGroup
      value={rpeValue}
      onChange={onSelectRPE}
      className="flex flex-col gap-2 rounded-md bg-accent p-2 text-accent-foreground"
    >
      <RadioGroup.Label className="text-sm font-medium text-muted-foreground">
        Exertion Rating
      </RadioGroup.Label>

      <RadioGroup.Description as="div" className="flex flex-col gap-1">
        <div className="text-center text-sm font-medium text-foreground">
          How difficult was your workout?
        </div>

        {rpeValue && (
          <div className="text-center text-sm text-foreground">
            {RPE_CONFIG[rpeValue].description} <RpeBadge rpeValue={rpeValue} />
          </div>
        )}
      </RadioGroup.Description>

      <div className="grid grid-cols-5 gap-2 px-3">
        <Option rpeValue="noEffort" />
        <Option rpeValue="easy" />
        <Option rpeValue="ideal" />
        <Option rpeValue="hard" />
        <Option rpeValue="maxEffort" />
      </div>
    </RadioGroup>
  );
};

const Option = ({ rpeValue }: { rpeValue: string }) => {
  return (
    <RadioGroup.Option
      value={rpeValue}
      className="flex flex-col items-center gap-0.5"
    >
      {({ checked }) => (
        <div className="flex flex-col items-center justify-center gap-1">
          <div
            className={clsx(
              'h-2.5 w-2.5 rounded-full hover:cursor-pointer hover:ring',
              RPE_CONFIG[rpeValue].bgColor,
              RPE_CONFIG[rpeValue].ringColor,
              'ring-offset-4 ring-offset-accent',
              { ring: checked },
            )}
          />
          <div
            className={clsx('text-center text-sm font-medium', {
              'text-foreground': checked,
              'text-muted-foreground': !checked,
            })}
          >
            {RPE_CONFIG[rpeValue].text}
          </div>
        </div>
      )}
    </RadioGroup.Option>
  );
};

export const RpeBadge = ({ rpeValue }: { rpeValue: RpeOptions }) => {
  return (
    <Badge
      variant="outline"
      className={clsx(
        RPE_CONFIG[rpeValue].bgColor,
        'border-transparent text-background',
      )}
    >
      {RPE_CONFIG[rpeValue].text}
    </Badge>
  );
};

export const RPE_CONFIG: {
  [key: string]: {
    bgColor: string;
    description: string;
    ringColor: string;
    text: string;
    textColor: string;
  };
} = {
  noEffort: {
    bgColor: 'bg-gray-300',
    description: 'Felt like no workout at all.',
    ringColor: 'ring-gray-300',
    text: 'No Effort',
    textColor: 'text-gray-500',
  },
  easy: {
    bgColor: 'bg-green-400',
    description: 'Comfortable and sustainable effort.',
    ringColor: 'ring-green-400',
    text: 'Easy',
    textColor: 'text-green-500',
  },
  ideal: {
    bgColor: 'bg-yellow-400',
    description: 'Challenging yet manageable workout.',
    ringColor: 'ring-yellow-400',
    text: 'Ideal',
    textColor: 'text-yellow-500',
  },
  hard: {
    bgColor: 'bg-orange-400',
    description: 'Pushed near your limits, quite tough.',
    ringColor: 'ring-orange-400',
    text: 'Hard',
    textColor: 'text-orange-500',
  },
  maxEffort: {
    bgColor: 'bg-red-500',
    description: 'Peak exertion, pushed to the absolute limit.',
    ringColor: 'ring-red-500',
    text: 'Max Effort',
    textColor: 'text-red-600',
  },
};
