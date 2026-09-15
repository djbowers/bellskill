import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { UserMovementRow, createOrReuseUserMovement } from './userMovement';

const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;

const typedRow: UserMovementRow = {
  id: 'um-typed',
  canonical_name: 'Double Kettlebell Front Rack Squat',
  functional_movement_id: 'mov-front-squat',
};

const stubUserMovements = (rows: UserMovementRow[]) => {
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];

  server.use(
    http.get(USER_MOVEMENTS_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const fk = params.get('functional_movement_id')?.replace('eq.', '');
      const name = params.get('canonical_name')?.replace('eq.', '');
      const match = rows.find(
        (r) =>
          (fk && r.functional_movement_id === fk) ||
          (name && r.canonical_name === name),
      );
      return HttpResponse.json(match ?? null);
    }),
    http.patch(USER_MOVEMENTS_URL, async ({ request }) => {
      const id = new URL(request.url).searchParams
        .get('id')!
        .replace('eq.', '');
      const body = (await request.json()) as Record<string, unknown>;
      patches.push({ id, body });
      const row = rows.find((r) => r.id === id)!;
      return HttpResponse.json({ ...row, ...body });
    }),
    http.post(USER_MOVEMENTS_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      inserts.push(body);
      return HttpResponse.json({ id: 'um-new', ...body }, { status: 201 });
    }),
  );

  return { patches, inserts };
};

describe('createOrReuseUserMovement', () => {
  test('reuses the row linked to the catalog movement and renames it to the picked name', async () => {
    const { patches, inserts } = stubUserMovements([typedRow]);

    const result = await createOrReuseUserMovement({
      userId: 'user-123',
      canonicalName: 'Double Kettlebell Front Squat',
      functionalMovementId: 'mov-front-squat',
    });

    expect(inserts).toHaveLength(0);
    expect(patches).toEqual([
      {
        id: 'um-typed',
        body: { canonical_name: 'Double Kettlebell Front Squat' },
      },
    ]);
    expect(result).toMatchObject({
      id: 'um-typed',
      canonical_name: 'Double Kettlebell Front Squat',
    });
  });

  test('returns the linked row as-is when the name already matches', async () => {
    const { patches, inserts } = stubUserMovements([typedRow]);

    const result = await createOrReuseUserMovement({
      userId: 'user-123',
      canonicalName: typedRow.canonical_name,
      functionalMovementId: 'mov-front-squat',
    });

    expect(patches).toHaveLength(0);
    expect(inserts).toHaveLength(0);
    expect(result).toEqual(typedRow);
  });

  test('links an existing unlinked row of the same name instead of inserting', async () => {
    const { patches, inserts } = stubUserMovements([
      { id: 'um-custom', canonical_name: 'Halo', functional_movement_id: null },
    ]);

    await createOrReuseUserMovement({
      userId: 'user-123',
      canonicalName: 'Halo',
      functionalMovementId: 'mov-halo',
    });

    expect(inserts).toHaveLength(0);
    expect(patches).toEqual([
      { id: 'um-custom', body: { functional_movement_id: 'mov-halo' } },
    ]);
  });

  test('inserts a custom row when nothing matches by catalog id or name', async () => {
    const { patches, inserts } = stubUserMovements([typedRow]);

    const result = await createOrReuseUserMovement({
      userId: 'user-123',
      canonicalName: 'Bottoms-Up Carry',
    });

    expect(patches).toHaveLength(0);
    expect(inserts).toEqual([
      {
        user_id: 'user-123',
        canonical_name: 'Bottoms-Up Carry',
        functional_movement_id: null,
      },
    ]);
    expect(result?.id).toBe('um-new');
  });
});
