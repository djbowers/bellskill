import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { MovementsPage } from './MovementsPage';

const MOVEMENT_ROWS = [
  {
    id: 1,
    'Difficulty Level': 'Beginner',
    Movement: 'Kettlebell Swing',
    'Movement Pattern #1': 'Hip Hinge',
    'Primary Equipment': 'Kettlebell',
    '# Primary Items': 1,
    'Single or Double Arm': null,
    'Target Muscle Group': 'Glutes',
  },
  {
    id: 2,
    'Difficulty Level': 'Intermediate',
    Movement: 'Goblet Squat',
    'Movement Pattern #1': 'Knee Dominant',
    'Primary Equipment': 'Kettlebell',
    '# Primary Items': 1,
    'Single or Double Arm': null,
    'Target Muscle Group': 'Quadriceps',
  },
];

const requestUrls: URL[] = [];

const DetailsProbe = () => {
  const { id } = useParams();
  return <div>movement details {id}</div>;
};

const renderPage = () => {
  requestUrls.length = 0;
  server.use(
    http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, ({ request }) => {
      const url = new URL(request.url);
      requestUrls.push(url);
      const pattern = url.searchParams.get('"Movement Pattern #1"');
      const rows = pattern
        ? MOVEMENT_ROWS.filter(
            (row) => `eq.${row['Movement Pattern #1']}` === pattern,
          )
        : MOVEMENT_ROWS;
      return HttpResponse.json(rows, {
        headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
      });
    }),
  );

  return render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter6Adapter}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="/" element={<MovementsPage />} />
            <Route path="/movements/:id" element={<DetailsProbe />} />
          </Routes>
        </QueryClientProvider>
      </QueryParamProvider>
    </MemoryRouter>,
  );
};

describe('movements page', () => {
  test('renders movements in both the table and the mobile list', async () => {
    renderPage();
    expect(await screen.findAllByText('Kettlebell Swing')).toHaveLength(2);
    expect(screen.getAllByText('Goblet Squat')).toHaveLength(2);
  });

  test('shows the movement pattern', async () => {
    renderPage();
    expect(await screen.findAllByText('Hip Hinge')).toHaveLength(2);
  });

  test('filters by movement pattern', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText('Kettlebell Swing');

    const patternTrigger = screen
      .getAllByText('Pattern')
      .map((element) => element.closest('button'))
      .find(Boolean);
    await user.click(patternTrigger!);
    await user.click(screen.getByRole('option', { name: 'Hip Hinge' }));

    await waitFor(() =>
      expect(
        requestUrls.at(-1)?.searchParams.get('"Movement Pattern #1"'),
      ).toBe('eq.Hip Hinge'),
    );
    await waitFor(() =>
      expect(screen.queryAllByText('Goblet Squat')).toHaveLength(0),
    );
  });

  test('clicking a table row navigates to the movement details page', async () => {
    const user = userEvent.setup();
    renderPage();

    const [tableCell] = await screen.findAllByText('Kettlebell Swing');
    await user.click(tableCell.closest('tr')!);

    expect(await screen.findByText('movement details 1')).toBeInTheDocument();
  });

  test('mobile rows link to the movement details page', async () => {
    renderPage();

    const [, mobileRow] = await screen.findAllByText('Kettlebell Swing');
    expect(mobileRow.closest('a')).toHaveAttribute('href', '/movements/1');
  });

  test('reset filters clears the pattern filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText('Kettlebell Swing');

    const patternTrigger = screen
      .getAllByText('Pattern')
      .map((element) => element.closest('button'))
      .find(Boolean);
    await user.click(patternTrigger!);
    await user.click(screen.getByRole('option', { name: 'Hip Hinge' }));
    await user.click(
      await screen.findByRole('button', { name: 'Reset Filters' }),
    );

    await waitFor(() =>
      expect(
        requestUrls.at(-1)?.searchParams.get('"Movement Pattern #1"'),
      ).toBeNull(),
    );
    expect(await screen.findAllByText('Goblet Squat')).toHaveLength(2);
  });

  test('the source filter swaps the catalog table for custom movements', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText('Kettlebell Swing');

    const sourceTrigger = screen
      .getAllByText('Catalog')
      .map((element) => element.closest('button'))
      .find(Boolean);
    await user.click(sourceTrigger!);
    await user.click(screen.getByRole('option', { name: 'My Custom' }));

    await waitFor(() =>
      expect(screen.queryAllByText('Kettlebell Swing')).toHaveLength(0),
    );
    expect(
      screen.queryByPlaceholderText('Search movements...'),
    ).not.toBeInTheDocument();
  });
});
