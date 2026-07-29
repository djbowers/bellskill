import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramProgressPage } from './ProgramProgressPage';

const { mockUseProgramProgress, mockSetAutoRepeat, mockUseQueuedPrograms } =
  vi.hoisted(() => ({
    mockUseProgramProgress: vi.fn(),
    mockSetAutoRepeat: { mutate: vi.fn(), isPending: false },
    mockUseQueuedPrograms: vi.fn(),
  }));

vi.mock('~/api', () => ({
  useProgramProgress: mockUseProgramProgress,
  useSetProgramAutoRepeat: () => mockSetAutoRepeat,
  useQueuedPrograms: mockUseQueuedPrograms,
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
  enrollment: { id: 'up-1', status: 'active', autoRepeat: false },
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

// Home stand-in that surfaces the nav state a started session was handed off in.
const HomeProbe = () => {
  const location = useLocation();
  const state = location.state as {
    startProgramSession?: { session: { id: string }; userProgramId: string };
  } | null;
  const chosen = state?.startProgramSession;
  return (
    <div>
      home
      {chosen && (
        <span data-testid="started">
          {chosen.userProgramId}:{chosen.session.id}
        </span>
      )}
    </div>
  );
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/programs/prog-1']}>
      <Routes>
        <Route path="/programs/:id" element={<ProgramProgressPage />} />
        <Route path="/history/:logId" element={<div>history detail</div>} />
        <Route path="/programs" element={<div>programs list</div>} />
        <Route path="/" element={<HomeProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProgramProgressPage', () => {
  beforeEach(() => {
    mockUseProgramProgress.mockReset();
    mockSetAutoRepeat.mutate.mockReset();
    mockSetAutoRepeat.isPending = false;
    mockUseQueuedPrograms.mockReturnValue({ data: [] });
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

    // Skipped sessions link nowhere.
    expect(screen.getByText('W1D2').closest('a')).toBeNull();
    // Upcoming sessions are actionable (a start button), not history links.
    expect(screen.getByText('W2D1').closest('a')).toBeNull();
    expect(screen.getByText('W2D1').closest('button')).not.toBeNull();
  });

  it('starts an upcoming session, handing it off to home with nav state', async () => {
    const user = userEvent.setup();
    mockUseProgramProgress.mockReturnValue({
      data: progressData,
      isLoading: false,
      isError: false,
    });

    renderPage();

    // Tapping a later upcoming session starts it — earlier gaps are untouched.
    await user.click(screen.getByText('W2D1').closest('button')!);

    expect(screen.getByText('home')).toBeInTheDocument();
    // Handed off with the enrollment id + the chosen session id.
    expect(screen.getByTestId('started')).toHaveTextContent('up-1:ps-2');
  });

  it('starts a later gap while an earlier upcoming session stays an untouched start button', async () => {
    const user = userEvent.setup();
    // Two upcoming sessions in the same week: starting the later one must leave
    // the earlier gap upcoming and actionable, never skipped.
    const twoUpcoming = {
      ...progressData,
      weeks: [
        {
          weekNumber: 2,
          sessions: [
            {
              session: session(2, 2, 1, 'W2D1'),
              state: 'upcoming',
              workoutLogId: null,
            },
            {
              session: session(3, 2, 2, 'W2D2'),
              state: 'upcoming',
              workoutLogId: null,
            },
          ],
        },
      ],
    };
    mockUseProgramProgress.mockReturnValue({
      data: twoUpcoming,
      isLoading: false,
      isError: false,
    });

    renderPage();

    // The earlier gap is a start button before the click...
    const earlier = screen.getByText('W2D1').closest('button');
    expect(earlier).not.toBeNull();

    // ...and clicking the LATER one hands off that session, not the earlier one.
    await user.click(screen.getByText('W2D2').closest('button')!);

    expect(screen.getByTestId('started')).toHaveTextContent('up-1:ps-3');
  });

  it('leaves upcoming sessions static when the enrollment is not active', () => {
    mockUseProgramProgress.mockReturnValue({
      data: {
        ...progressData,
        enrollment: { id: 'up-1', status: 'completed' },
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('W2D1').closest('button')).toBeNull();
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

  it('toggles auto-repeat on the enrollment via the switch', async () => {
    const user = userEvent.setup();
    mockUseProgramProgress.mockReturnValue({
      data: progressData,
      isLoading: false,
      isError: false,
    });

    renderPage();

    const toggle = screen.getByRole('switch', {
      name: 'Repeat automatically when finished',
    });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(mockSetAutoRepeat.mutate).toHaveBeenCalledWith({
      userProgramId: 'up-1',
      autoRepeat: true,
    });
  });

  it('shows the repeating summary and disables the switch while saving', () => {
    mockSetAutoRepeat.isPending = true;
    mockUseProgramProgress.mockReturnValue({
      data: {
        ...progressData,
        enrollment: {
          id: 'up-1',
          status: 'active',
          autoRepeat: true,
          cyclesCompleted: 2,
        },
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('Repeating workout')).toBeInTheDocument();
    expect(screen.getByText('2 cycles done')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', {
        name: 'Repeat automatically when finished',
      }),
    ).toBeDisabled();
  });

  it('names the front of the queue under the summary while active', () => {
    mockUseProgramProgress.mockReturnValue({
      data: progressData,
      isLoading: false,
      isError: false,
    });
    mockUseQueuedPrograms.mockReturnValue({
      data: [
        {
          enrollment: { id: 'q-1', queuePosition: 1, status: 'queued' },
          program: { title: 'Armor Building Complex' },
        },
      ],
    });

    renderPage();

    expect(
      screen.getByText('Next up: Armor Building Complex'),
    ).toBeInTheDocument();
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
