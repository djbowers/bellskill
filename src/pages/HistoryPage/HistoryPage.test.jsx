import { composeStories } from '@storybook/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '~/env';
import { ExampleWorkoutLog } from '~/examples';
import { server } from '~/mocks/server';

import * as stories from './HistoryPage.stories';

const { Default } = composeStories(stories);

describe('workout history page', () => {
  beforeEach(() => {
    render(<Default />);
  });

  test('renders name of movement', async () => {
    await screen.findAllByText('Clean and Press', { exact: false });
  });

  test('renders workout details', async () => {
    await screen.findAllByText('The Giant', { exact: false });
  });

  test('renders workout volume', async () => {
    await screen.findByText('1,000 kg');
  });

  test('renders workout date', async () => {
    // Two sessions share Nov 9; each row carries its own date.
    expect(await screen.findAllByText('Thu 9')).toHaveLength(2);
  });

  test('renders rep count for bodyweight workouts', async () => {
    await screen.findByText('50 reps');
  });

  test('marks complex sets on the session row', async () => {
    await screen.findByText(/Complex/);
  });

  test('does not mark workouts without complex_set', async () => {
    await screen.findByText('50 reps');
    expect(screen.getAllByText(/Complex/)).toHaveLength(1);
  });

  test('summarizes each week by session count and volume', async () => {
    await screen.findByText('3 sessions · 1,000 kg');
  });

  test('omits volume from the summary of a bodyweight-only week', async () => {
    // Weeks of Oct 16 and Oct 23 log reps only, so volume is left off.
    expect(await screen.findAllByText('3 sessions')).toHaveLength(2);
  });

  test('describes the week strip for screen readers', async () => {
    const strips = await screen.findAllByRole('img');
    expect(
      strips.some((strip) =>
        strip.getAttribute('aria-label')?.includes('not trained'),
      ),
    ).toBe(true);
  });
});

describe('workout history pagination', () => {
  const PAGE_SIZE = 20;

  // 25 workouts, most-recent first by started_at — spans two pages of 20.
  const manyWorkoutLogs = Array.from(
    { length: 25 },
    (_, i) =>
      new ExampleWorkoutLog({
        movements: ['Kettlebell Swing'],
        started_at: new Date(2025, 0, 25 - i).toISOString(),
        title: `Session ${i + 1}`,
      }),
  );

  beforeEach(() => {
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, ({ request }) => {
        const url = new URL(request.url);
        const sorted = [...manyWorkoutLogs].sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        );

        const from = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? sorted.length);
        const to = from + limit - 1;
        const page = sorted.slice(from, from + limit);

        return HttpResponse.json(page, {
          headers: { 'Content-Range': `${from}-${to}/${sorted.length}` },
        });
      }),
    );

    render(<Default />);
  });

  test('renders only the first page of workouts initially', async () => {
    await screen.findByText('Session 1');
    expect(screen.queryByText('Session 25')).not.toBeInTheDocument();
  });

  test('shows a Load More button when more workouts are available', async () => {
    await screen.findByText('Session 1');
    expect(
      screen.getByRole('button', { name: 'Load More' }),
    ).toBeInTheDocument();
  });

  test('appends the next page and hides Load More on the last page', async () => {
    const user = userEvent.setup();

    await screen.findByText('Session 1');
    await user.click(screen.getByRole('button', { name: 'Load More' }));

    await screen.findByText('Session 25');

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Load More' }),
      ).not.toBeInTheDocument();
    });
  });

  test('loads the configured page size on the first request', async () => {
    await screen.findByText('Session 1');
    // Sessions 1-20 are the first page; Session 21 is on the next page.
    expect(screen.queryByText(`Session ${PAGE_SIZE}`)).toBeInTheDocument();
    expect(
      screen.queryByText(`Session ${PAGE_SIZE + 1}`),
    ).not.toBeInTheDocument();
  });
});
