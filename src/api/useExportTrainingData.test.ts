import { HttpResponse, http } from 'msw';

import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { buildTrainingExport } from './useExportTrainingData';

const base = `${VITE_SUPABASE_URL}/rest/v1`;

const workoutLog = { id: 1, user_id: 'user-123', movements: ['Clean'] };
const movementLog = { id: 10, workout_log_id: 1, movement_name: 'Clean' };

const useHandlers = () => {
  server.use(
    http.get(`${base}/profiles`, ({ request }) => {
      const select = new URL(request.url).searchParams.get('select');
      expect(select).toBe('username,training_goal');
      return HttpResponse.json({ username: 'luke', training_goal: 'strength' });
    }),
    http.get(`${base}/workout_logs`, () => HttpResponse.json([workoutLog])),
    http.get(`${base}/movement_logs`, () => HttpResponse.json([movementLog])),
    http.get(`${base}/user_movements`, () =>
      HttpResponse.json([{ id: 5, canonical_name: 'Clean' }]),
    ),
    http.get(`${base}/user_equipment`, () =>
      HttpResponse.json([{ id: 7, kind: 'kettlebell', weight: 24 }]),
    ),
    http.get(`${base}/user_programs`, () =>
      HttpResponse.json([{ id: 'up-1', program_id: 'p-1' }]),
    ),
    http.get(`${base}/programs`, () =>
      HttpResponse.json([{ id: 'p-1', title: 'DFW' }]),
    ),
    http.get(`${base}/program_sessions`, () =>
      HttpResponse.json([{ id: 'ps-1', program_id: 'p-1' }]),
    ),
    http.get(`${base}/program_session_completions`, () =>
      HttpResponse.json([{ id: 'c-1', user_program_id: 'up-1' }]),
    ),
    http.post(`${base}/rpc/pattern_debt_movements`, () =>
      HttpResponse.json([{ movement_name: 'Clean', total_reps: 100 }]),
    ),
  );
};

describe('buildTrainingExport', () => {
  test('assembles every training section with agent-facing metadata', async () => {
    useHandlers();

    const result = await buildTrainingExport('user-123');

    expect(result.meta.app).toBe('Bellskill');
    expect(result.meta.export_version).toBe(1);
    expect(result.meta.exported_at).toBeTruthy();
    expect(result.meta.schema.workout_logs).toContain('rep_scheme');
    expect(result.profile).toEqual({
      username: 'luke',
      training_goal: 'strength',
    });
    expect(result.workout_logs).toEqual([workoutLog]);
    expect(result.movement_logs).toEqual([movementLog]);
    expect(result.user_movements).toHaveLength(1);
    expect(result.user_equipment).toHaveLength(1);
    expect(result.programs).toEqual({
      enrollments: [{ id: 'up-1', program_id: 'p-1' }],
      programs: [{ id: 'p-1', title: 'DFW' }],
      sessions: [{ id: 'ps-1', program_id: 'p-1' }],
      completions: [{ id: 'c-1', user_program_id: 'up-1' }],
    });
    expect(result.pattern_debt).toEqual([
      { movement_name: 'Clean', total_reps: 100 },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('stripe');
    expect(serialized).not.toContain('spotify');
  });

  test('exports pattern_debt as null when the RPC fails', async () => {
    useHandlers();
    server.use(
      http.post(`${base}/rpc/pattern_debt_movements`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );

    const result = await buildTrainingExport('user-123');

    expect(result.pattern_debt).toBeNull();
    expect(result.workout_logs).toEqual([workoutLog]);
  });
});
