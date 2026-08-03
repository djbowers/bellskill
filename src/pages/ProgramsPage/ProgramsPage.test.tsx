import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramsPage } from './ProgramsPage';

const {
  mockUsePrograms,
  mockUseActivePrograms,
  mockUseCreateProgram,
  mockUseEnrollProgram,
  mockUseResumeProgram,
  mockUseProgramProgress,
  mockUseCancelProgram,
  mockUseDeleteProgram,
  mockUseSetProgramArchived,
  mockUseQueuedPrograms,
  mockUseDequeueProgram,
  mockUseStartQueuedProgram,
  mockTrackEvent,
  enrollMutate,
  resumeMutate,
  createMutate,
  cancelMutate,
  deleteMutate,
  setArchivedMutate,
  dequeueMutate,
  startQueuedMutate,
} = vi.hoisted(() => ({
  mockUsePrograms: vi.fn(),
  mockUseActivePrograms: vi.fn(),
  mockUseCreateProgram: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  mockUseResumeProgram: vi.fn(),
  mockUseProgramProgress: vi.fn(),
  mockUseCancelProgram: vi.fn(),
  mockUseDeleteProgram: vi.fn(),
  mockUseSetProgramArchived: vi.fn(),
  mockUseQueuedPrograms: vi.fn(),
  mockUseDequeueProgram: vi.fn(),
  mockUseStartQueuedProgram: vi.fn(),
  mockTrackEvent: vi.fn(),
  enrollMutate: vi.fn(),
  resumeMutate: vi.fn(),
  createMutate: vi.fn(),
  cancelMutate: vi.fn(),
  deleteMutate: vi.fn(),
  setArchivedMutate: vi.fn(),
  dequeueMutate: vi.fn(),
  startQueuedMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  usePrograms: mockUsePrograms,
  useActivePrograms: mockUseActivePrograms,
  useCreateProgram: mockUseCreateProgram,
  useEnrollProgram: mockUseEnrollProgram,
  useResumeProgram: mockUseResumeProgram,
  useProgramProgress: mockUseProgramProgress,
  useCancelProgram: mockUseCancelProgram,
  useDeleteProgram: mockUseDeleteProgram,
  useSetProgramArchived: mockUseSetProgramArchived,
  useQueuedPrograms: mockUseQueuedPrograms,
  useDequeueProgram: mockUseDequeueProgram,
  useStartQueuedProgram: mockUseStartQueuedProgram,
  // Recommender off: these tests cover the page's baseline surface; the
  // recommendation section has its own suite.
  useFeatureFlags: () => ({ features: { recommender: false }, isPending: false }),
  trackEvent: mockTrackEvent,
  AnalyticsEvent: { ProgramResumed: 'program_resumed' },
  MAX_ACTIVE_PROGRAMS: 3,
}));

let mockSessionEmail: string | undefined;

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return {
    ...actual,
    useSession: () => ({ user: { id: 'user-123', email: mockSessionEmail } }),
  };
});

const dfw = {
  id: 'dfw-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'dry-fighting-weight',
  title: 'Dry Fighting Weight',
  description: null,
  authorName: 'Geoff Neupert',
  numWeeks: 5,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '',
  releasedAt: null,
  focusTags: ['strength', 'hypertrophy', 'conditioning'],
};

const armor = {
  id: 'armor-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'armor-building-complex',
  title: 'Armor Building Complex',
  description: null,
  authorName: 'Dan John',
  numWeeks: 6,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '',
  releasedAt: null,
  focusTags: ['hypertrophy', 'strength', 'conditioning'],
};

const myProgram = {
  id: 'mine-1',
  ownerId: 'user-123',
  sourceProgramId: null,
  slug: null,
  title: 'My Program',
  description: null,
  authorName: null,
  numWeeks: 4,
  daysPerWeek: 3,
  isPublic: false,
  createdAt: '',
  releasedAt: null,
  focusTags: [],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/programs']}>
      <Routes>
        <Route path="/programs" element={<ProgramsPage />} />
        <Route
          path="/programs/:id/sessions/new"
          element={<div>builder for program</div>}
        />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );

/**
 * Secondary and destructive card actions live behind the card's ⋯ menu now, so
 * every one of them is a two-step interaction: open the menu, pick the item.
 */
const openCardMenu = (programTitle: string) => {
  fireEvent.keyDown(
    screen.getByRole('button', { name: `More actions for ${programTitle}` }),
    { key: 'Enter' },
  );
};

/**
 * Menu actions are deferred a tick so the menu can close before a dialog mounts
 * (see ProgramCardMenu), so selecting one has to be awaited.
 */
/**
 * The catalog sits below "My programs" behind a disclosure, folded by default
 * for anyone who already has programs of their own.
 */
const expandBrowse = () =>
  fireEvent.click(screen.getByRole('button', { name: /Browse programs/ }));

const clickMenuItem = async (name: string) => {
  fireEvent.click(screen.getByRole('menuitem', { name }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('ProgramsPage', () => {
  beforeEach(() => {
    mockSessionEmail = undefined;
    enrollMutate.mockReset();
    resumeMutate.mockReset();
    createMutate.mockReset();
    cancelMutate.mockReset();
    deleteMutate.mockReset();
    setArchivedMutate.mockReset();
    mockTrackEvent.mockReset();
    mockUsePrograms.mockReturnValue({
      data: [dfw, myProgram],
      isLoading: false,
    });
    mockUseActivePrograms.mockReturnValue({ data: [] });
    mockUseCreateProgram.mockReturnValue({
      mutate: createMutate,
      isPending: false,
    });
    mockUseEnrollProgram.mockReturnValue({
      mutate: enrollMutate,
      isPending: false,
    });
    mockUseResumeProgram.mockReturnValue({
      mutate: resumeMutate,
      isPending: false,
    });
    // Default: no prior progress for any candidate, so an own-program "Start"
    // routes straight to a fresh enroll. Individual tests override this.
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data: id
        ? { program: { id }, enrollment: null, completedCount: 0 }
        : undefined,
      isError: false,
    }));
    mockUseCancelProgram.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    });
    mockUseDeleteProgram.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    });
    mockUseSetProgramArchived.mockReturnValue({
      mutate: setArchivedMutate,
      isPending: false,
    });
    dequeueMutate.mockReset();
    startQueuedMutate.mockReset();
    mockUseQueuedPrograms.mockReturnValue({ data: [] });
    mockUseDequeueProgram.mockReturnValue({
      mutate: dequeueMutate,
      isPending: false,
    });
    mockUseStartQueuedProgram.mockReturnValue({
      mutate: startQueuedMutate,
      isPending: false,
    });
  });

  it('links each shared program row to its details view instead of enrolling inline', () => {
    mockUsePrograms.mockReturnValue({
      data: [dfw, armor, myProgram],
      isLoading: false,
    });

    renderPage();
    expandBrowse();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(screen.getByText('Armor Building Complex')).toBeInTheDocument();
    expect(screen.getByText('Dan John · 6 weeks · 3/week')).toBeInTheDocument();

    // Rows navigate to the pre-enroll details page — starting now happens there.
    expect(
      screen.getByRole('link', { name: 'View Dry Fighting Weight' }),
    ).toHaveAttribute('href', '/programs/dfw-1/details');
    expect(
      screen.getByRole('link', { name: 'View Armor Building Complex' }),
    ).toHaveAttribute('href', '/programs/armor-1/details');

    // The old per-row Start button is gone; no starting-weight prompt here.
    expect(
      screen.queryByRole('button', { name: 'Start Dry Fighting Weight' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Starting weight')).not.toBeInTheDocument();
  });

  it('folds the catalog away when you already have programs of your own', () => {
    renderPage();

    // "My programs" leads the page; the seed list waits behind a disclosure.
    expect(screen.queryByText('Dry Fighting Weight')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Browse programs/ }),
    ).toHaveAttribute('aria-expanded', 'false');

    expandBrowse();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Browse programs/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the catalog for a user with no programs of their own', () => {
    mockUsePrograms.mockReturnValue({ data: [dfw], isLoading: false });

    renderPage();

    // Nothing of their own to lead with, so the catalog is the page.
    expect(
      screen.getByRole('button', { name: /Browse programs/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
  });

  it('orders my programs by what is running, then startable, then unfinished', () => {
    const running = { ...myProgram, id: 'mine-2', title: 'Running Program' };
    const draft = {
      ...myProgram,
      id: 'mine-3',
      title: 'Draft Program',
      numWeeks: null,
      daysPerWeek: null,
    };
    // Deliberately supplied worst-first.
    mockUsePrograms.mockReturnValue({
      data: [draft, myProgram, running],
      isLoading: false,
    });
    mockUseActivePrograms.mockReturnValue({
      data: [
        {
          enrollment: {
            id: 'up-1',
            programId: 'mine-2',
            status: 'active',
            activeSlot: 1,
          },
          program: { title: 'Running Program' },
          progress: { completed: 0, total: 3 },
        },
      ],
    });

    renderPage();

    const cards = screen.getAllByTestId('my-program-card');
    expect(cards[0]).toHaveTextContent('Running Program');
    expect(cards[1]).toHaveTextContent('My Program');
    expect(cards[2]).toHaveTextContent('Draft Program');

    // Each tier names itself, so the three treatments are never guesswork.
    expect(cards[0]).toHaveTextContent('Active');
    expect(cards[1]).toHaveTextContent('Ready');
    expect(cards[2]).toHaveTextContent('Draft');
  });

  it('chips a shared program’s focus tags in taxonomy order, and none for an untagged one', () => {
    mockUsePrograms.mockReturnValue({
      data: [{ ...dfw, focusTags: ['conditioning', 'strength'] }, myProgram],
      isLoading: false,
    });

    renderPage();
    expandBrowse();

    // Taxonomy order (strength before conditioning), not the order authored.
    const chips = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(chips).toEqual(['Strength', 'Conditioning']);
    // myProgram is untagged, so its card contributes no chips at all.
    expect(screen.getByText('My Program')).toBeInTheDocument();
  });

  it('labels a repeating workout and badges it, instead of a week cadence', () => {
    const simpleSinister = {
      ...dfw,
      id: 'ss-1',
      slug: 'simple-and-sinister',
      title: 'Simple & Sinister',
      authorName: 'Pavel Tsatsouline (StrongFirst)',
      numWeeks: null,
      daysPerWeek: null,
      defaultAutoRepeat: true,
    };
    mockUsePrograms.mockReturnValue({
      data: [simpleSinister],
      isLoading: false,
    });

    renderPage();

    // Cadence reads "Repeating workout", not a weeks/day span, and a badge shows.
    expect(
      screen.getByText('Pavel Tsatsouline (StrongFirst) · Repeating workout'),
    ).toBeInTheDocument();
    expect(screen.getByText('Repeats')).toBeInTheDocument();
  });

  it('badges released shared programs for the owner account only', () => {
    mockSessionEmail = 'daniel_bowers@icloud.com';
    mockUsePrograms.mockReturnValue({
      data: [
        { ...dfw, releasedAt: '2026-07-28T12:00:00Z' },
        { ...armor, releasedAt: null },
      ],
      isLoading: false,
    });

    renderPage();

    // Chip on the released program only.
    expect(screen.getAllByText('Released')).toHaveLength(1);
    expect(
      screen.getByLabelText('View Dry Fighting Weight'),
    ).toHaveTextContent('Released');
    expect(
      screen.getByLabelText('View Armor Building Complex'),
    ).not.toHaveTextContent('Released');
  });

  it('never shows the released badge to a non-owner', () => {
    mockUsePrograms.mockReturnValue({
      data: [{ ...dfw, releasedAt: '2026-07-28T12:00:00Z' }],
      isLoading: false,
    });

    renderPage();

    expect(screen.queryByText('Released')).not.toBeInTheDocument();
  });

  it('enrolls in your own program directly, with no starting-weight prompt', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(screen.queryByText('Starting weight')).not.toBeInTheDocument();
    expect(enrollMutate).toHaveBeenCalledWith(
      { programId: 'mine-1' },
      expect.anything(),
    );
  });

  it('offers resume vs start-over for a program with prior progress, and resumes on confirm', () => {
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data:
        id === 'mine-1'
          ? {
              program: { id: 'mine-1' },
              enrollment: { id: 'up-9', status: 'completed' },
              completedCount: 3,
            }
          : id
            ? { program: { id }, enrollment: null, completedCount: 0 }
            : undefined,
      isError: false,
    }));
    resumeMutate.mockImplementation((_input, { onSuccess }) => onSuccess());

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    // Prior progress gates the fresh enroll behind a resume-vs-start-over choice.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Resume this program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    // Resumes by the exact enrollment id the prompt is showing, not the program.
    expect(resumeMutate).toHaveBeenCalledWith(
      { userProgramId: 'up-9' },
      expect.anything(),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'program_resumed' }),
    );
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('starts a prior-progress program over on the start-over choice', () => {
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data:
        id === 'mine-1'
          ? {
              program: { id: 'mine-1' },
              enrollment: { id: 'up-9', status: 'abandoned' },
              completedCount: 2,
            }
          : id
            ? { program: { id }, enrollment: null, completedCount: 0 }
            : undefined,
      isError: false,
    }));

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));
    expect(screen.getByText('Resume this program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

    expect(resumeMutate).not.toHaveBeenCalled();
    expect(enrollMutate).toHaveBeenCalledWith(
      { programId: 'mine-1' },
      expect.anything(),
    );
  });

  it('shows "No sessions yet" for a program whose cadence is not derived yet', () => {
    mockUsePrograms.mockReturnValue({
      data: [{ ...myProgram, numWeeks: null, daysPerWeek: null }],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('creates a program from the inline form and navigates into the builder', () => {
    createMutate.mockImplementation((_input, { onSuccess }) =>
      onSuccess({ id: 'mine-1' }),
    );

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Create program' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'New Program' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create and add sessions' }),
    );

    expect(createMutate).toHaveBeenCalledWith(
      { title: 'New Program' },
      expect.anything(),
    );
    expect(screen.getByText('builder for program')).toBeInTheDocument();
  });

  it('cancels the active program only after confirming', async () => {
    mockUseActivePrograms.mockReturnValue({
      data: [
        {
          enrollment: { id: 'up-1', programId: 'mine-1', status: 'active' },
          program: { title: 'My Program' },
          progress: { completed: 0, total: 3 },
        },
      ],
    });

    renderPage();

    // The management "Cancel program" surfaces only on the active card's menu.
    openCardMenu('My Program');
    await clickMenuItem('Cancel program');

    // The RPC is gated behind an explicit confirm (progress is discarded).
    expect(cancelMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Cancel program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel program' }));

    expect(cancelMutate).toHaveBeenCalledWith({ userProgramId: 'up-1' });
  });

  it('hard-deletes a program only after an explicit confirm', async () => {
    renderPage();

    openCardMenu('My Program');
    await clickMenuItem('Delete program');

    // Irreversible — nothing happens until the confirm dialog is accepted.
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Delete program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(deleteMutate).toHaveBeenCalledWith({ programId: 'mine-1' });
  });

  it('archives a live program (no confirm — it is reversible)', async () => {
    renderPage();

    openCardMenu('My Program');
    await clickMenuItem('Archive program');

    expect(setArchivedMutate).toHaveBeenCalledWith({
      programId: 'mine-1',
      archived: true,
    });
  });

  it('hides archived programs behind a toggle and restores them', () => {
    const archived = {
      ...myProgram,
      id: 'arch-1',
      title: 'Old Program',
      archivedAt: '2026-07-01T00:00:00Z',
    };
    mockUsePrograms.mockReturnValue({
      data: [dfw, myProgram, archived],
      isLoading: false,
    });

    renderPage();

    // Archived programs are hidden from the default list.
    expect(screen.queryByText('Old Program')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(screen.getByText('Old Program')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(setArchivedMutate).toHaveBeenCalledWith({
      programId: 'arch-1',
      archived: false,
    });
  });

  it('reads an archived program with no sessions through the cadence label', () => {
    mockUsePrograms.mockReturnValue({
      data: [
        {
          ...myProgram,
          id: 'arch-1',
          title: 'Old Program',
          numWeeks: null,
          daysPerWeek: null,
          archivedAt: '2026-07-01T00:00:00Z',
        },
      ],
      isLoading: false,
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }));

    // Regression: this card used to print the raw "null weeks · null/week".
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('leads a draft program with Add sessions and demotes the rest to the menu', () => {
    mockUsePrograms.mockReturnValue({
      data: [{ ...myProgram, numWeeks: null, daysPerWeek: null }],
      isLoading: false,
    });

    renderPage();

    // A program with no sessions cannot be started — the one CTA is the thing
    // it actually needs.
    expect(
      screen.getByRole('button', { name: 'Add sessions' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start program' }),
    ).not.toBeInTheDocument();

    openCardMenu('My Program');
    expect(
      screen.getByRole('menuitem', { name: 'View progress' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Delete program' }),
    ).toBeInTheDocument();
  });

  const threeActive = [1, 2, 3].map((slot) => ({
    enrollment: {
      id: `up-${slot}`,
      programId: `other-${slot}`,
      status: 'active',
      activeSlot: slot,
    },
    program: { title: `Running ${slot}` },
    progress: { completed: 0, total: 3 },
  }));

  it('offers "Queue instead" when every slot is taken and queues without replacing', () => {
    mockUseActivePrograms.mockReturnValue({ data: threeActive });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    // The replace prompt now carries a third path.
    fireEvent.click(screen.getByRole('button', { name: 'Queue instead' }));

    expect(enrollMutate).toHaveBeenCalledWith({
      programId: 'mine-1',
      queue: true,
    });
    // Queueing replaces nothing.
    expect(
      screen.queryByRole('button', { name: 'Queue instead' }),
    ).not.toBeInTheDocument();
  });

  it('lists queued programs in order with Remove, hiding Start now at the cap', () => {
    mockUseActivePrograms.mockReturnValue({ data: threeActive });
    mockUseQueuedPrograms.mockReturnValue({
      data: [
        {
          enrollment: { id: 'q-1', queuePosition: 1, status: 'queued' },
          program: { title: 'Queued First' },
        },
        {
          enrollment: { id: 'q-2', queuePosition: 2, status: 'queued' },
          program: { title: 'Queued Second' },
        },
      ],
    });

    renderPage();

    const rows = screen.getAllByTestId('queued-program');
    expect(rows[0]).toHaveTextContent('Queued First');
    expect(rows[1]).toHaveTextContent('Queued Second');

    // No free slot, so nothing can start immediately.
    expect(
      screen.queryByRole('button', { name: 'Start now' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove' })[1],
    );
    expect(dequeueMutate).toHaveBeenCalledWith({ userProgramId: 'q-2' });
  });

  it('queues an own program for later from its card, without a slot claim', async () => {
    renderPage();

    openCardMenu('My Program');
    await clickMenuItem('Queue for later');

    expect(enrollMutate).toHaveBeenCalledWith({
      programId: 'mine-1',
      queue: true,
    });
  });

  it('hides Queue for later and badges the card once the program is queued', () => {
    mockUseQueuedPrograms.mockReturnValue({
      data: [
        {
          enrollment: {
            id: 'q-1',
            programId: 'mine-1',
            queuePosition: 1,
            status: 'queued',
          },
          program: { title: 'My Program' },
        },
      ],
    });

    renderPage();

    expect(screen.getByText('Queued', { selector: 'span' })).toBeInTheDocument();
    // Starting from the card would double-enroll alongside the queued clone;
    // a queued program starts from "Up next" instead, so the card offers no
    // start at all — not even a disabled one.
    expect(
      screen.queryByRole('button', { name: 'Start program' }),
    ).not.toBeInTheDocument();

    openCardMenu('My Program');
    expect(
      screen.queryByRole('menuitem', { name: 'Queue for later' }),
    ).not.toBeInTheDocument();
  });

  it('chains each queued row to the one before it, with Start now only at the front', () => {
    mockUseActivePrograms.mockReturnValue({ data: [threeActive[0]] });
    mockUseQueuedPrograms.mockReturnValue({
      data: [
        {
          enrollment: { id: 'q-1', queuePosition: 1, status: 'queued' },
          program: { title: 'Queued First' },
        },
        {
          enrollment: { id: 'q-2', queuePosition: 2, status: 'queued' },
          program: { title: 'Queued Second' },
        },
      ],
    });

    renderPage();

    const rows = screen.getAllByTestId('queued-program');
    // The front waits on a slot (one is open); the rest wait on the row ahead.
    expect(rows[0]).toHaveTextContent('A slot is open');
    expect(rows[1]).toHaveTextContent('After Queued First');
    expect(screen.getAllByRole('button', { name: 'Start now' })).toHaveLength(
      1,
    );
  });

  it('starts a queued program into the lowest free slot when one is open', () => {
    mockUseActivePrograms.mockReturnValue({ data: [threeActive[0]] });
    mockUseQueuedPrograms.mockReturnValue({
      data: [
        {
          enrollment: { id: 'q-1', queuePosition: 1, status: 'queued' },
          program: { title: 'Queued First' },
        },
      ],
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start now' }));

    expect(startQueuedMutate).toHaveBeenCalledWith(
      { userProgramId: 'q-1', slot: 2 },
      expect.anything(),
    );
  });
});
