import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';
import { ProgramStage } from '~/types';

import { VITE_SUPABASE_URL } from '../../../env';
import { StageCard } from './StageCard';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/set_program_stage`;

const showToast = vi.fn();

const mockSession = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
    aud: '',
  },
  access_token: '',
  refresh_token: '',
  expires_in: 10000,
  token_type: '',
};

const STAGES: ProgramStage[] = [
  { title: 'C+J', movements: [] },
  { title: 'C+J+C', movements: [] },
  { title: 'C+J+C+J', movements: [] },
];

const renderCard = (
  props: Partial<React.ComponentProps<typeof StageCard>> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider value={mockSession}>
        <ToastContext.Provider value={{ showToast }}>
          <StageCard
            userProgramId="up-1"
            stages={STAGES}
            currentStageIndex={0}
            canAdvance
            {...props}
          />
        </ToastContext.Provider>
      </SessionProvider>
    </QueryClientProvider>,
  );
};

describe('StageCard', () => {
  beforeEach(() => showToast.mockClear());

  it('shows the current stage position and title', () => {
    renderCard({ currentStageIndex: 1 });
    expect(screen.getByText('Stage 2 of 3: C+J+C')).toBeInTheDocument();
  });

  it('advances to the next stage after confirming', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(6);
      }),
    );

    renderCard();

    await user.click(screen.getByRole('button', { name: 'Advance stage' }));
    expect(screen.getByText('Move to C+J+C?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move to C+J+C' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        p_user_program_id: 'up-1',
        p_stage_index: 1,
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      'Moved to C+J+C — 6 upcoming sessions updated',
    );
  });

  it('goes back a stage after confirming', async () => {
    const user = userEvent.setup();
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(4);
      }),
    );

    renderCard({ currentStageIndex: 2 });

    await user.click(screen.getByRole('button', { name: 'Go back' }));
    await user.click(screen.getByRole('button', { name: 'Move to C+J+C' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        p_user_program_id: 'up-1',
        p_stage_index: 1,
      }),
    );
  });

  it('hides Go back at the first stage', () => {
    renderCard({ currentStageIndex: 0 });
    expect(
      screen.queryByRole('button', { name: 'Go back' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Advance stage' }),
    ).toBeInTheDocument();
  });

  it('hides Advance at the last stage', () => {
    renderCard({ currentStageIndex: 2 });
    expect(
      screen.queryByRole('button', { name: 'Advance stage' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('hides both actions when the enrollment is not active', () => {
    renderCard({ currentStageIndex: 1, canAdvance: false });
    expect(
      screen.queryByRole('button', { name: 'Advance stage' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Go back' }),
    ).not.toBeInTheDocument();
  });
});
