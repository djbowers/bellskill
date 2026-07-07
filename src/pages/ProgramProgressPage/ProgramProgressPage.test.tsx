import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramProgressPage } from './ProgramProgressPage';

const { mockUseProgramProgress } = vi.hoisted(() => ({
  mockUseProgramProgress: vi.fn(),
}));

vi.mock('~/api', () => ({
  useProgramProgress: mockUseProgramProgress,
}));

const session = (seq: number, week: number, day: number, title: string) => ({
  id: `ps-${seq}`,
  programId: 'prog-1',
  sequenceIndex: seq,
  weekNumber: week,
  dayNumber: day,
  title,
  notes: null,
  workoutOptions: {} as never,
});

const progressData = {
  program: { id: 'prog-1', title: 'Dry Fighting Weight', numWeeks: 2 },
  enrollment: { id: 'up-1', status: 'active' },
  weeks: [
    {
      weekNumber: 1,
      sessions: [
        { session: session(0, 1, 1, 'W1D1'), state: 'done', workoutLogId: 42 },
        {
          session: session(1, 1, 2, 'W1D2'),
          state: 'skipped',
          workoutLogId: null,
        },
      ],
    },
    {
      weekNumber: 2,
      sessions: [
        {
          session: session(2, 2, 1, 'W2D1'),
          state: 'upcoming',
          workoutLogId: null,
        },
      ],
    },
  ],
  completedCount: 2,
  totalCount: 3,
  currentWeek: 2,
  totalWeeks: 2,
  isComplete: false,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/programs/prog-1']}>
      <Routes>
        <Route path="/programs/:id" element={<ProgramProgressPage />} />
        <Route path="/history/:logId" element={<div>history detail</div>} />
        <Route path="/programs" element={<div>programs list</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProgramProgressPage', () => {
  beforeEach(() => {
    mockUseProgramProgress.mockReset();
  });

  it('renders the summary, week groups, and session states', () => {
    mockUseProgramProgress.mockReturnValue({
      data: progressData,
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 sessions')).toBeInTheDocument();
    expect(screen.getByText('Week 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('W1D1')).toBeInTheDocument();
  });

  it('links a completed session chip to its logged workout', () => {
    mockUseProgramProgress.mockReturnValue({
      data: progressData,
      isLoading: false,
      isError: false,
    });

    renderPage();

    const doneChip = screen.getByText('W1D1').closest('a');
    expect(doneChip).toHaveAttribute('href', '/history/42');

    // Skipped and upcoming sessions are not links.
    expect(screen.getByText('W1D2').closest('a')).toBeNull();
    expect(screen.getByText('W2D1').closest('a')).toBeNull();
  });

  it('shows the complete state when the program is finished', () => {
    mockUseProgramProgress.mockReturnValue({
      data: { ...progressData, isComplete: true },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('🎉 Program complete')).toBeInTheDocument();
  });

  it('renders a not-found state on error', () => {
    mockUseProgramProgress.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderPage();

    expect(screen.getByText('Program not found.')).toBeInTheDocument();
  });
});
