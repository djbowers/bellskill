import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useActiveProgram,
  useCreateProgram,
  useEnrollProgram,
  usePrograms,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Program } from '~/types';

const DEFAULT_WEEKS = 5;
const DEFAULT_DAYS_PER_WEEK = 3;

export const ProgramsPage = () => {
  const navigate = useNavigate();
  const { data: programs = [], isLoading } = usePrograms();
  const { data: activeProgram } = useActiveProgram();
  const createProgram = useCreateProgram();
  const enroll = useEnrollProgram();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [numWeeks, setNumWeeks] = useState(DEFAULT_WEEKS);
  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULT_DAYS_PER_WEEK);

  // Program the user is trying to switch to while another is already active.
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);

  const sharedPrograms = programs.filter((p) => p.isPublic);
  const myPrograms = programs.filter((p) => !p.isPublic);
  const dfw =
    sharedPrograms.find((p) => p.slug === 'dry-fighting-weight') ??
    sharedPrograms[0];

  const enrollIn = (programId: string) =>
    enroll.mutate(programId, { onSuccess: () => navigate('/') });

  // Only an *active* enrollment blocks a fresh enroll — a completed program may
  // still be returned by useActiveProgram (to drive the home "complete" card),
  // but starting a new program then needs no "switch?" confirmation.
  const activeEnrollment =
    activeProgram?.enrollment.status === 'active' ? activeProgram : null;

  const handleEnroll = (programId: string) => {
    if (
      activeEnrollment &&
      activeEnrollment.enrollment.programId !== programId
    ) {
      setPendingSwitchId(programId);
    } else {
      enrollIn(programId);
    }
  };

  const confirmSwitch = () => {
    if (!pendingSwitchId) return;
    const target = pendingSwitchId;
    setPendingSwitchId(null);
    enrollIn(target);
  };

  const handleCreate = () => {
    if (title.trim().length === 0) return;
    createProgram.mutate(
      { title: title.trim(), numWeeks, daysPerWeek },
      {
        onSuccess: (program) =>
          navigate(`/programs/${program.id}/sessions/new`),
      },
    );
  };

  const isActive = (program: Program) =>
    activeEnrollment?.enrollment.programId === program.id;

  return (
    <Page title="Programs">
      {dfw && (
        <Card>
          <CardHeader>
            <CardTitle>{dfw.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {dfw.authorName ? `${dfw.authorName} · ` : ''}
              {dfw.numWeeks} weeks · {dfw.daysPerWeek}/week
            </p>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => handleEnroll(dfw.id)}
              disabled={enroll.isLoading}
            >
              {`Start ${dfw.title}`}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">My programs</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowCreate((v) => !v)}
        >
          Create program
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-2">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="program-title">Title</Label>
              <Input
                id="program-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dry Fighting Weight"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-0.5">
                <Label htmlFor="program-weeks">Weeks</Label>
                <Input
                  id="program-weeks"
                  type="number"
                  min={1}
                  value={numWeeks}
                  onChange={(e) =>
                    setNumWeeks(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <Label htmlFor="program-days">Days / week</Label>
                <Input
                  id="program-days"
                  type="number"
                  min={1}
                  value={daysPerWeek}
                  onChange={(e) =>
                    setDaysPerWeek(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={title.trim().length === 0 || createProgram.isLoading}
            >
              {createProgram.isLoading
                ? 'Creating…'
                : 'Create and add sessions'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading programs…</p>
      )}

      {!isLoading && myPrograms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven't created any programs yet.
        </p>
      )}

      {myPrograms.map((program) => (
        <Card key={program.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {program.title}
              {isActive(program) && (
                <span className="rounded bg-primary px-0.5 text-xs text-primary-foreground">
                  Active
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {program.numWeeks} weeks · {program.daysPerWeek}/week
            </p>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => navigate(`/programs/${program.id}/sessions/new`)}
            >
              Add sessions
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleEnroll(program.id)}
              disabled={enroll.isLoading || isActive(program)}
            >
              {isActive(program) ? 'Enrolled' : 'Start program'}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={pendingSwitchId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitchId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch program?</DialogTitle>
            <DialogDescription>
              You already have an active program
              {activeEnrollment ? ` (${activeEnrollment.program.title})` : ''}.
              Starting a new one abandons your current progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPendingSwitchId(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmSwitch} disabled={enroll.isLoading}>
              Switch program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};
