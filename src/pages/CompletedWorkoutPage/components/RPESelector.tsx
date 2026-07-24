import { Description, Label, Radio, RadioGroup } from '@headlessui/react';
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
      <Label className="text-sm font-medium text-muted-foreground">
        Exertion Rating
      </Label>

      <Description as="div" className="flex flex-col gap-1">
        <div className="text-center text-sm font-medium text-foreground">
          How difficult was your workout?
        </div>

        {rpeValue && (
          <div className="text-center text-sm text-foreground">
            {RPE_CONFIG[rpeValue].description} <RpeBadge rpeValue={rpeValue} />
          </div>
        )}
      </Description>

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
    <Radio value={rpeValue} className="flex flex-col items-center gap-0.5">
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
    </Radio>
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

// Colors come from the shared exertion ramp (--intensity-0…4 in tailwind.css),
// so the selector, the badge, and the History week strip read as one scale.
// eslint-disable-next-line react-refresh/only-export-components -- RPE config constant is intentionally co-located with its selector component; splitting the module is out of scope for the lint pass
export const RPE_CONFIG: {
  [key: string]: {
    bgColor: string;
    description: string;
    ringColor: string;
    text: string;
  };
} = {
  noEffort: {
    bgColor: 'bg-intensity-0',
    description: 'Felt like no workout at all.',
    ringColor: 'ring-intensity-0',
    text: 'No Effort',
  },
  easy: {
    bgColor: 'bg-intensity-1',
    description: 'Comfortable and sustainable effort.',
    ringColor: 'ring-intensity-1',
    text: 'Easy',
  },
  ideal: {
    bgColor: 'bg-intensity-2',
    description: 'Challenging yet manageable workout.',
    ringColor: 'ring-intensity-2',
    text: 'Ideal',
  },
  hard: {
    bgColor: 'bg-intensity-3',
    description: 'Pushed near your limits, quite tough.',
    ringColor: 'ring-intensity-3',
    text: 'Hard',
  },
  maxEffort: {
    bgColor: 'bg-intensity-4',
    description: 'Peak exertion, pushed to the absolute limit.',
    ringColor: 'ring-intensity-4',
    text: 'Max Effort',
  },
};
