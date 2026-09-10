import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

import { DerivedNode } from '../utils/deriveNodeStates';
import { NODE_STATE_LABELS } from '../utils/nodeStateStyles';
import { LoadSection } from './LoadSection';

interface NodeDialogProps {
  derived: DerivedNode | null;
  derivedById: ReadonlyMap<string, DerivedNode>;
  /** Catalog movements whose logs count toward each node, by node id. */
  movementsByNodeId: ReadonlyMap<string, string[]>;
  isPending: boolean;
  onClose: () => void;
  onStart: (nodeId: string) => void;
  onPass: (nodeId: string) => void;
  onUndo: (nodeId: string) => void;
}

const formatPassedDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const NodeDialog = ({
  derived,
  derivedById,
  movementsByNodeId,
  isPending,
  onClose,
  onStart,
  onPass,
  onUndo,
}: NodeDialogProps) => {
  if (!derived) return null;

  const { node, state, missingPrereqIds, completedAt, completionSource, load } =
    derived;
  const countedMovements = movementsByNodeId.get(node.id) ?? [];
  const missingTitles = missingPrereqIds.map(
    (id) => derivedById.get(id)?.node.title ?? id,
  );
  const showAdvisory = state !== 'complete' && missingTitles.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">
            {node.title}
            {node.kind === 'mobility' && (
              <Badge variant="outline">Mobility</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Level {node.level} · {NODE_STATE_LABELS[state]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 text-sm">
          <Section title="Skills">
            <ul className="list-disc pl-3">
              {node.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </Section>

          {(node.prereqs.length > 0 || node.prereqNotes.length > 0) && (
            <Section title="Prerequisites">
              <ul className="flex flex-col gap-0.5">
                {node.prereqs.map((id) => {
                  const prereq = derivedById.get(id);
                  return (
                    <li key={id} className="flex justify-between gap-1">
                      <span>{prereq?.node.title ?? id}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {prereq ? NODE_STATE_LABELS[prereq.state] : 'Unknown'}
                      </span>
                    </li>
                  );
                })}
                {node.prereqNotes.map((note) => (
                  <li key={note} className="text-muted-foreground">
                    {note}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {load && (
            <Section title="Load">
              <LoadSection load={load} movements={countedMovements} />
            </Section>
          )}

          <Section title="Benchmark">
            <p>{node.benchmark}</p>
          </Section>

          {showAdvisory && (
            <p className="rounded-md bg-muted/50 p-1 text-xs text-muted-foreground">
              Heads up — prerequisites not complete: {missingTitles.join(', ')}.
              You can still practice this; the tree only advises.
            </p>
          )}
        </div>

        <DialogFooter className="gap-1">
          {completionSource === 'logs' ? (
            <span className="self-center text-xs text-muted-foreground">
              Passed from your logs
              {completedAt ? ` ${formatPassedDate(completedAt)}` : ''}
            </span>
          ) : state === 'complete' ? (
            <>
              <span className="self-center text-xs text-muted-foreground">
                Passed {completedAt ? formatPassedDate(completedAt) : ''}
              </span>
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={() => onUndo(node.id)}
              >
                Undo
              </Button>
            </>
          ) : state === 'active' ? (
            <>
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={() => onUndo(node.id)}
              >
                Undo
              </Button>
              <Button disabled={isPending} onClick={() => onPass(node.id)}>
                Mark benchmark passed
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => onPass(node.id)}
              >
                Mark benchmark passed
              </Button>
              <Button disabled={isPending} onClick={() => onStart(node.id)}>
                Start practicing
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </div>
);
