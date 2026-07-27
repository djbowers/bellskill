import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ITEM_WIDTH, ValueCarousel } from './ValueCarousel';

const clickValue = (value: number) => {
  const button = screen.getByText(String(value)).closest('button');
  fireEvent.click(button!);
};

/** jsdom has no layout, so give the track just enough of one to scroll. */
const layoutTrack = (container: HTMLElement) => {
  const track = container.querySelector<HTMLDivElement>(
    '[aria-hidden="true"]',
  )!;
  Object.defineProperty(track, 'clientWidth', {
    value: ITEM_WIDTH * 5,
    configurable: true,
  });
  return track;
};

const settleAt = (track: HTMLDivElement, index: number) => {
  track.scrollLeft = index * ITEM_WIDTH;
  fireEvent.scroll(track);
  fireEvent(track, new Event('scrollend'));
  vi.advanceTimersByTime(200);
};

describe('ValueCarousel', () => {
  it('renders every value in the range', () => {
    render(
      <ValueCarousel min={1} max={5} step={1} value={3} onChange={vi.fn()} />,
    );

    [1, 2, 3, 4, 5].forEach((value) => {
      expect(screen.getByText(String(value))).toBeInTheDocument();
    });
  });

  it('keeps a long range out of the DOM, holding its width with spacers', () => {
    const { container } = render(
      <ValueCarousel
        min={10}
        max={3000}
        step={10}
        value={1000}
        onChange={vi.fn()}
      />,
    );

    const rendered = container.querySelectorAll('button');
    expect(rendered.length).toBeLessThan(30);
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('2000')).not.toBeInTheDocument();

    const track = container.querySelector('[aria-hidden="true"]')!;
    const spacers = track.querySelectorAll(':scope > div');
    const spacerWidth = [...spacers].reduce(
      (total, spacer) =>
        total + Number((spacer as HTMLElement).style.width.replace('px', '')),
      0,
    );
    expect(spacerWidth + rendered.length * ITEM_WIDTH).toBe(300 * ITEM_WIDTH);
  });

  it('walks the range by step', () => {
    render(
      <ValueCarousel min={5} max={20} step={5} value={10} onChange={vi.fn()} />,
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('11')).not.toBeInTheDocument();
  });

  it('selects a value that is tapped', () => {
    const onChange = vi.fn();
    render(
      <ValueCarousel min={1} max={5} step={1} value={3} onChange={onChange} />,
    );

    clickValue(5);

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('hands a tap on the centered value to the center display', () => {
    const onChange = vi.fn();
    const onSelectCenter = vi.fn();
    render(
      <ValueCarousel
        min={1}
        max={5}
        step={1}
        value={3}
        onChange={onChange}
        onSelectCenter={onSelectCenter}
      />,
    );

    clickValue(3);

    expect(onSelectCenter).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves an out-of-range value alone instead of snapping it in', () => {
    const onChange = vi.fn();
    render(
      <ValueCarousel
        min={1}
        max={5}
        step={1}
        value={500}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('chips the values a color is given for, and only those', () => {
    const { container } = render(
      <ValueCarousel
        min={1}
        max={3}
        step={1}
        value={2}
        onChange={vi.fn()}
        chipColor={(value) => (value === 2 ? '#3fa45b' : null)}
      />,
    );

    const chips = container.querySelectorAll('[style*="background"]');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveStyle({ background: '#3fa45b' });
  });

  it('renders no chip row when no colors are supplied', () => {
    const { container } = render(
      <ValueCarousel min={1} max={3} step={1} value={2} onChange={vi.fn()} />,
    );

    expect(container.querySelectorAll('button span')).toHaveLength(3);
  });

  describe('settling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('commits the value the user swiped to', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ValueCarousel
          min={1}
          max={40}
          step={1}
          value={24}
          onChange={onChange}
        />,
      );
      const track = layoutTrack(container);

      fireEvent.pointerDown(track);
      settleAt(track, 31);

      expect(onChange).toHaveBeenCalledWith(32);
    });

    it('ignores a settle the user did not cause', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ValueCarousel
          min={1}
          max={40}
          step={1}
          value={24}
          onChange={onChange}
        />,
      );

      // The browser fires one of these at position 0 before the strip is
      // placed; committing it would collapse the value to the minimum.
      settleAt(layoutTrack(container), 0);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('commits a fling even when the fallback timer settles early', () => {
      // iOS Safari has no scrollend, so settles come from a timer that can
      // fire mid-fling — the fling's real landing must still commit.
      const descriptor = Object.getOwnPropertyDescriptor(
        window,
        'onscrollend',
      )!;
      delete (window as { onscrollend?: unknown }).onscrollend;

      try {
        const onChange = vi.fn();
        const { container } = render(
          <ValueCarousel
            min={1}
            max={40}
            step={1}
            value={24}
            onChange={onChange}
          />,
        );
        const track = layoutTrack(container);

        fireEvent.pointerDown(track);
        track.scrollLeft = 23 * ITEM_WIDTH;
        fireEvent.scroll(track);
        vi.advanceTimersByTime(200); // premature settle, still at the value
        track.scrollLeft = 31 * ITEM_WIDTH;
        fireEvent.scroll(track);
        vi.advanceTimersByTime(200); // the fling's real landing

        expect(onChange).toHaveBeenCalledWith(32);
      } finally {
        Object.defineProperty(window, 'onscrollend', descriptor);
      }
    });

    it('disarms a gesture that never scrolled', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ValueCarousel
          min={1}
          max={40}
          step={1}
          value={24}
          onChange={onChange}
        />,
      );
      const track = layoutTrack(container);

      // A tap that moves nothing must not turn the next settle — e.g. from a
      // programmatic scroll after a +/- press — into a user commit.
      fireEvent.pointerDown(track);
      fireEvent.pointerUp(track);
      settleAt(track, 31);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('snaps the display back after a settle it did not cause', () => {
      const onChange = vi.fn();
      const onFocusChange = vi.fn();
      const { container } = render(
        <ValueCarousel
          min={1}
          max={40}
          step={1}
          value={24}
          onChange={onChange}
          onFocusChange={onFocusChange}
        />,
      );

      settleAt(layoutTrack(container), 0);

      expect(onChange).not.toHaveBeenCalled();
      expect(onFocusChange).toHaveBeenLastCalledWith(24);
    });

    it('keeps trying to position the strip until it has width', () => {
      const { container } = render(
        <ValueCarousel min={1} max={40} step={1} value={24} onChange={vi.fn()} />,
      );
      const track = container.querySelector<HTMLDivElement>(
        '[aria-hidden="true"]',
      )!;
      const scrollTo = vi.fn();
      Object.defineProperty(track, 'scrollTo', {
        value: scrollTo,
        configurable: true,
      });

      vi.advanceTimersByTime(100); // frames pass with no layout — keep waiting
      expect(scrollTo).not.toHaveBeenCalled();

      layoutTrack(container);
      vi.advanceTimersByTime(100);

      expect(scrollTo).toHaveBeenCalledWith({
        left: 23 * ITEM_WIDTH,
        behavior: 'auto',
      });
    });

    it('does not re-commit a value it was just given', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ValueCarousel
          min={1}
          max={40}
          step={1}
          value={24}
          onChange={onChange}
        />,
      );
      const track = layoutTrack(container);

      fireEvent.pointerDown(track);
      settleAt(track, 23);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('keeps the strip out of the accessibility tree', () => {
    render(
      <ValueCarousel min={1} max={3} step={1} value={2} onChange={vi.fn()} />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
