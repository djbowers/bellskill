import type { UserEquipment } from '~/api';
import { Card, CardContent } from '~/components/ui/card';
import { EquipmentSummary, allLoadableWeights, getBellColor } from '~/utils';

interface LoadableWeightsCardProps {
  items: UserEquipment[];
  summary: EquipmentSummary;
}

const POUNDS_TO_KG = 0.45359237;

const toKg = (value: number, unit: UserEquipment['unit']) =>
  unit === 'pounds' ? value * POUNDS_TO_KG : value;

/**
 * The spectrum of weights the recommender is allowed to prescribe, drawn from
 * the same summary the edge functions receive. Adjustable bells read as a span,
 * fixed bells as points, so a gap in coverage is visible rather than implied.
 */
export const LoadableWeightsCard = ({
  items,
  summary,
}: LoadableWeightsCardProps) => {
  const weights = allLoadableWeights(summary);
  const low = weights[0].weight_kg;
  const high = weights[weights.length - 1].weight_kg;
  const span = high - low;

  const position = (kg: number) => (span === 0 ? 50 : ((kg - low) / span) * 100);

  const bands = items
    .filter((item) => item.kind === 'adjustable')
    .map((item) => ({
      id: item.id,
      start: position(toKg(item.minWeight!, item.unit)),
      end: position(toKg(item.maxWeight!, item.unit)),
    }));

  const bellCount = summary.adjustable_bell_count;

  return (
    <Card>
      <CardContent className="flex min-w-0 flex-col gap-1.5 pt-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your loadable weights
        </h2>

        <div className="relative h-4" aria-hidden="true">
          {bands.map((band) => (
            <div
              key={band.id}
              className="absolute top-1 h-1 rounded-full border border-primary/40 bg-primary/20"
              style={{
                left: `${band.start}%`,
                width: `${Math.max(band.end - band.start, 1)}%`,
              }}
            />
          ))}

          <div className="absolute inset-x-0 top-1.5 h-px bg-border" />

          {weights.map((weight) => (
            <div
              key={weight.weight_kg}
              className="absolute top-1 h-1 w-1 -translate-x-1/2 rounded-full ring-1 ring-card"
              style={{
                left: `${position(weight.weight_kg)}%`,
                backgroundColor:
                  getBellColor(weight.weight_kg, 'kilograms') ??
                  'hsl(var(--primary))',
                outline: weight.doubles
                  ? '1.5px solid hsl(var(--primary))'
                  : undefined,
                outlineOffset: '1.5px',
              }}
            />
          ))}

          {span === 0 ? (
            <span className="absolute inset-x-0 top-2.5 text-center text-[10px] text-muted-foreground">
              {low} kg
            </span>
          ) : (
            <>
              <span className="absolute left-0 top-2.5 text-[10px] text-muted-foreground">
                {low} kg
              </span>
              <span className="absolute right-0 top-2.5 text-[10px] text-muted-foreground">
                {high} kg
              </span>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {weights.length === 1
            ? '1 loadable weight'
            : `${weights.length} loadable weights`}
          . Recommendations only prescribe these.
          {bellCount > 0 &&
            ` Your ${bellCount === 1 ? 'adjustable bell keeps one weight' : `${bellCount} adjustable bells each keep one weight`} for a whole session — you'll never be asked to re-plate mid-workout.`}
        </p>
      </CardContent>
    </Card>
  );
};
