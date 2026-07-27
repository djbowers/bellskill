import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WeightUnitTabs } from '~/components/WeightUnitTabs';

import { ModifyCountButtons } from './ModifyCountButtons';

const setup = (overrides = {}) => {
  const props = {
    onChange: vi.fn(),
    onClickMinus: vi.fn(),
    onClickPlus: vi.fn(),
    unit: 'reps',
    value: 5,
    ...overrides,
  };
  return { ...render(<ModifyCountButtons {...props} />), props };
};

describe('ModifyCountButtons', () => {
  it('labels the step buttons with the unit', () => {
    const { props } = setup({ unit: 'kg' });

    fireEvent.click(screen.getByRole('button', { name: '- kg' }));
    fireEvent.click(screen.getByRole('button', { name: '+ kg' }));

    expect(props.onClickMinus).toHaveBeenCalledOnce();
    expect(props.onClickPlus).toHaveBeenCalledOnce();
  });

  it('exposes exactly one number field, showing the value', () => {
    setup({ value: 24 });

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue(24);
  });

  it('reports typed values', () => {
    const { props } = setup();

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '12' },
    });

    expect(props.onChange).toHaveBeenCalledWith(12);
  });

  it('selects a value swiped to on the strip', () => {
    const { props } = setup({ min: 1, max: 10, value: 5 });

    fireEvent.click(screen.getByText('8').closest('button')!);

    expect(props.onChange).toHaveBeenCalledWith(8);
  });

  it('renders the unit as a label by default', () => {
    setup({ unit: 'sec' });

    expect(screen.getByText('sec')).toBeInTheDocument();
  });

  it('renders unit tabs in place of the label when given', () => {
    setup({
      unit: 'kg',
      unitTabs: <WeightUnitTabs value="kilograms" onChange={vi.fn()} />,
    });

    expect(screen.getByRole('tab', { name: 'kg' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'lb' })).toBeInTheDocument();
  });

  it('keeps the center display on the value after a stray settle', () => {
    const { container } = setup({ min: 1, max: 40, value: 24 });
    const track = container.querySelector<HTMLDivElement>(
      'div[aria-hidden="true"].no-select',
    )!;
    Object.defineProperty(track, 'clientWidth', {
      value: 240,
      configurable: true,
    });

    // The browser can fire a settle at position 0 before the strip is placed;
    // the display must not drift off the committed value.
    track.scrollLeft = 0;
    fireEvent.scroll(track);
    fireEvent(track, new Event('scrollend'));

    expect(screen.getByRole('spinbutton')).toHaveValue(24);
  });

  it('color-codes the strip only when a bell unit is given', () => {
    const { container, unmount } = setup({
      min: 20,
      max: 28,
      value: 24,
      unit: 'kg',
      bellUnit: 'kilograms',
    });
    expect(container.querySelectorAll('[style*="background"]').length).toBe(3);
    unmount();

    const plain = setup({ min: 20, max: 28, value: 24, unit: 'reps' });
    expect(
      plain.container.querySelectorAll('[style*="background"]'),
    ).toHaveLength(0);
  });
});
