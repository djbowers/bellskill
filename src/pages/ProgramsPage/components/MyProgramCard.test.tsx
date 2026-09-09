import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { Program } from '~/types';
import { ProgramArc } from '~/utils';

import { MyProgramCard } from './MyProgramCard';

const program: Program = {
  id: 'p-1',
  ownerId: 'user-1',
  sourceProgramId: null,
  slug: null,
  title: 'Dry Fighting Weight',
  description: null,
  authorName: null,
  numWeeks: 5,
  daysPerWeek: 3,
  isPublic: false,
  createdAt: '',
  archivedAt: null,
  releasedAt: null,
  defaultAutoRepeat: false,
  stages: null,
  focusTags: [],
  systemicDemand: null,
};

const arc: ProgramArc = {
  sessionNumber: 8,
  totalSessions: 15,
  dayNumber: 12,
  totalDays: 35,
  projectedFinish: new Date(2026, 10, 11),
  sessionsAhead: 0,
};

const renderCard = (
  overrides: Partial<React.ComponentProps<typeof MyProgramCard>> = {},
) =>
  render(
    <MemoryRouter>
      <MyProgramCard
        program={program}
        isActive={false}
        isQueued={false}
        isStarting={false}
        pending={{
          enroll: false,
          resume: false,
          cancel: false,
          archive: false,
          delete: false,
        }}
        onStart={vi.fn()}
        onAddSessions={vi.fn()}
        onViewProgress={vi.fn()}
        onQueueForLater={vi.fn()}
        onRename={vi.fn()}
        onCancel={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );

describe('MyProgramCard finish line', () => {
  it('leads an active program with its arc position, finish date, and pace', () => {
    renderCard({ isActive: true, arc });

    expect(
      screen.getByText('Session 8 of 15 · Day 12 of 35'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Finishes ~Nov 11/)).toBeInTheDocument();
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.queryByText('5 weeks · 3/week')).not.toBeInTheDocument();
  });

  it.each([
    [2, '2 sessions ahead'],
    [-1, '1 session behind'],
  ])('reads pace %i as "%s"', (sessionsAhead, label) => {
    renderCard({ isActive: true, arc: { ...arc, sessionsAhead } });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows position only for a running repeating workout', () => {
    renderCard({
      isActive: true,
      program: { ...program, defaultAutoRepeat: true },
      arc: {
        ...arc,
        totalDays: null,
        projectedFinish: null,
        sessionsAhead: null,
      },
    });

    expect(screen.getByText('Session 8 of 15')).toBeInTheDocument();
    expect(screen.queryByText(/Finishes/)).not.toBeInTheDocument();
  });

  it('keeps the cadence line on a program that is not running', () => {
    renderCard({ arc });

    expect(screen.getByText('5 weeks · 3/week')).toBeInTheDocument();
    expect(screen.queryByText(/Session 8/)).not.toBeInTheDocument();
  });
});
