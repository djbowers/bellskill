import { MovementOptions, WeightTabValue } from '~/types';
import {
  WEIGHT_MODE_LABELS,
  formatRungDuration,
  getBellColor,
  getWeightTabValue,
  getWeightUnitLabel,
} from '~/utils';

const loadSummary = (movement: MovementOptions): string | null => {
  const { weightOneValue, weightOneUnit, weightTwoValue, weightTwoUnit } =
    movement;
  if (!weightOneValue) return null;
  const one = `${weightOneValue} ${getWeightUnitLabel(weightOneUnit)}`;

  // Two bells: "16 kg ×2" when matched, otherwise spell both out.
  if (weightTwoValue && weightTwoValue > 0) {
    const two = `${weightTwoValue} ${getWeightUnitLabel(weightTwoUnit)}`;
    return weightOneValue === weightTwoValue && weightOneUnit === weightTwoUnit
      ? `${one} ×2`
      : `${one} + ${two}`;
  }
  return one;
};

const repSummary = (movement: MovementOptions): string => {
  const { repScheme, timedRungs } = movement;
  const fmt = (rung: number) =>
    timedRungs ? formatRungDuration(rung) : `${rung}`;
  if (repScheme.length === 0) return '—';
  if (repScheme.length === 1) {
    return timedRungs ? fmt(repScheme[0]) : `${repScheme[0]} reps`;
  }
  return `Ladder ${repScheme.map(fmt).join('·')}`;
};

/**
 * The collapsed, scannable view of a movement: its weight mode, load (with the
 * competition-color bell dot), and rep scheme at a glance.
 */
export const MovementSummaryChips = ({
  movement,
  weightMode,
}: {
  movement: MovementOptions;
  /** Active mode; for complex sets this is the shared-weight mode, not the movement's own. */
  weightMode?: WeightTabValue;
}) => {
  const mode = weightMode ?? getWeightTabValue(movement);
  const load = loadSummary(movement);
  const bellColor = getBellColor(movement.weightOneValue ?? 0, movement.weightOneUnit);

  return (
    <div className="flex flex-wrap gap-0.5">
      <span className="inline-flex items-center rounded-full bg-muted/70 px-1 py-0.5 text-xs font-medium">
        {WEIGHT_MODE_LABELS[mode]}
      </span>
      {load && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/70 px-1 py-0.5 text-xs font-medium">
          {bellColor && (
            <span
              className="h-1 w-1 rounded-full ring-1 ring-black/20"
              style={{ backgroundColor: bellColor }}
              aria-hidden
            />
          )}
          {load}
        </span>
      )}
      <span className="inline-flex items-center rounded-full bg-muted/70 px-1 py-0.5 text-xs font-medium">
        {repSummary(movement)}
      </span>
    </div>
  );
};
