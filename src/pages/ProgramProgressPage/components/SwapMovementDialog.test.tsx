import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { WeightTabValue } from '~/types';

import { MovementWeightControl } from '~/pages/ProgramDetailsPage/utils/deriveMovementWeights';

import { SwapMovementDialog } from './SwapMovementDialog';

const { mockSwapMutate, mockShowToast } = vi.hoisted(() => ({
  mockSwapMutate: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('~/api', () => ({
  useSwapProgramMovement: () => ({
    mutate: mockSwapMutate,
    isPending: false,
  }),
}));

vi.mock('~/contexts', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('~/components/MovementAutocomplete', () => ({
  MovementAutocomplete: ({
    value,
    onChange,
    weightMode,
    onWeightModeChange,
  }: {
    value: string;
    onChange: (name: string) => void;
    weightMode: WeightTabValue;
    onWeightModeChange: (mode: WeightTabValue) => void;
  }) => (
    <div>
      <input
        aria-label="Movement Input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span data-testid="weight-mode">{weightMode}</span>
      <button type="button" onClick={() => onWeightModeChange('double')}>
        Mode Double
      </button>
    </div>
  ),
}));

const control = (
  movementName: string,
  mode: WeightTabValue,
  weightOneValue: number | null = 24,
  weightTwoValue: number | null = null,
): MovementWeightControl => ({
  movementName,
  mode,
  modalWeight: {
    sharedWeightOneValue: weightOneValue,
    sharedWeightOneUnit: weightOneValue === null ? null : 'kilograms',
    sharedWeightTwoValue: weightTwoValue,
    sharedWeightTwoUnit: weightTwoValue === null ? null : 'kilograms',
  },
});

const movements = [control('Kettlebell Swing', '2h'), control('Clean', '1h', 20, 0)];

describe('SwapMovementDialog', () => {
  beforeEach(() => {
    mockSwapMutate.mockReset();
    mockShowToast.mockReset();
  });

  it('renders the locked old movement and seeds its weight mode', () => {
    render(
      <SwapMovementDialog
        open
        onOpenChange={vi.fn()}
        movements={movements}
        userProgramId="up-1"
        oldMovementName="Kettlebell Swing"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Swap movement' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    expect(screen.getByTestId('weight-mode')).toHaveTextContent('2h');
  });

  it('blocks a replacement name already in the program', async () => {
    const user = userEvent.setup();
    render(
      <SwapMovementDialog
        open
        onOpenChange={vi.fn()}
        movements={movements}
        userProgramId="up-1"
        oldMovementName="Kettlebell Swing"
      />,
    );

    await user.type(screen.getByLabelText('Movement Input'), 'clean');

    expect(
      screen.getByText(/already in this program/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Swap movement' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Swap movement' }));
    expect(mockSwapMutate).not.toHaveBeenCalled();
  });

  it('submits the swap with the carried-over weight and closes on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mockSwapMutate.mockImplementation((_args, { onSuccess }) => onSuccess(3));

    render(
      <SwapMovementDialog
        open
        onOpenChange={onOpenChange}
        movements={movements}
        userProgramId="up-1"
        oldMovementName="Kettlebell Swing"
      />,
    );

    await user.type(screen.getByLabelText('Movement Input'), 'Snatch');
    await user.click(screen.getByRole('button', { name: 'Swap movement' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      {
        userProgramId: 'up-1',
        oldMovementName: 'Kettlebell Swing',
        newMovementName: 'Snatch',
        weightOneValue: 24,
        weightOneUnit: 'kilograms',
        weightTwoValue: null,
        weightTwoUnit: null,
      },
      expect.anything(),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      'Movement swapped in 3 upcoming sessions',
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('re-encodes the weight when the mode changes to double', async () => {
    const user = userEvent.setup();
    mockSwapMutate.mockImplementation((_args, { onSuccess }) => onSuccess(1));

    render(
      <SwapMovementDialog
        open
        onOpenChange={vi.fn()}
        movements={movements}
        userProgramId="up-1"
        oldMovementName="Kettlebell Swing"
      />,
    );

    await user.type(screen.getByLabelText('Movement Input'), 'Double Clean');
    await user.click(screen.getByRole('button', { name: 'Mode Double' }));
    await user.click(screen.getByRole('button', { name: 'Swap movement' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        newMovementName: 'Double Clean',
        weightOneValue: 24,
        weightTwoValue: 24,
        weightTwoUnit: 'kilograms',
      }),
      expect.anything(),
    );
  });

  it('hands the swap to onPendingSwap instead of mutating', async () => {
    const user = userEvent.setup();
    const onPendingSwap = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SwapMovementDialog
        open
        onOpenChange={onOpenChange}
        movements={movements}
        oldMovementName="Clean"
        onPendingSwap={onPendingSwap}
      />,
    );

    await user.type(screen.getByLabelText('Movement Input'), 'Press');
    await user.click(screen.getByRole('button', { name: 'Swap movement' }));

    expect(onPendingSwap).toHaveBeenCalledWith({
      oldMovementName: 'Clean',
      newMovementName: 'Press',
      weightOneValue: 20,
      weightOneUnit: 'kilograms',
      weightTwoValue: 0,
      weightTwoUnit: 'kilograms',
    });
    expect(mockSwapMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks names claimed by other pending swaps via extraTakenNames', async () => {
    const user = userEvent.setup();
    render(
      <SwapMovementDialog
        open
        onOpenChange={vi.fn()}
        movements={movements}
        oldMovementName="Kettlebell Swing"
        onPendingSwap={vi.fn()}
        extraTakenNames={['Press']}
      />,
    );

    await user.type(screen.getByLabelText('Movement Input'), 'press');

    expect(
      screen.getByRole('button', { name: 'Swap movement' }),
    ).toBeDisabled();
  });
});
