import { type QueuedProgram } from '~/api';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { cn } from '~/lib/utils';

export interface QueueTimelineProps {
  queuedPrograms: QueuedProgram[];
  /** The lowest free parallel slot, or null at the cap. Gates "Start now". */
  freeSlot: number | null;
  pending: { start: boolean; remove: boolean };
  onStartNow: (userProgramId: string, slot: number) => void;
  onRemove: (userProgramId: string) => void;
}

/**
 * "Up next", drawn as a real timeline: the numbered spine is a sequence, so the
 * numbering carries information the reader needs. Each row names what it waits
 * on — the front waits on a slot, everything behind waits on the row ahead.
 */
export const QueueTimeline = ({
  queuedPrograms,
  freeSlot,
  pending,
  onStartNow,
  onRemove,
}: QueueTimelineProps) => (
  <Card>
    <CardContent className="flex flex-col pt-2">
      {queuedPrograms.map(({ enrollment, program }, index) => {
        const isFront = index === 0;
        const isLast = index === queuedPrograms.length - 1;
        const waitsOn = isFront
          ? freeSlot !== null
            ? 'A slot is open'
            : 'Starts when an active program finishes'
          : `After ${queuedPrograms[index - 1].program.title}`;

        return (
          <div
            key={enrollment.id}
            className={cn('flex items-start gap-1.5', !isLast && 'pb-2')}
            data-testid="queued-program"
          >
            <div className="flex flex-col items-center self-stretch">
              <span
                aria-hidden
                className={cn(
                  'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  isFront
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground',
                )}
              >
                {index + 1}
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{program.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {waitsOn}
              </p>
            </div>
            {isFront && freeSlot !== null && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onStartNow(enrollment.id, freeSlot)}
                disabled={pending.start}
              >
                Start now
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onRemove(enrollment.id)}
              disabled={pending.remove}
            >
              Remove
            </Button>
          </div>
        );
      })}
    </CardContent>
  </Card>
);
