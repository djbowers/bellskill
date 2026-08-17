import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { MarkdownLite } from './MarkdownLite';
import { toBlocks } from './parseMarkdown';

describe('toBlocks', () => {
  test('groups consecutive bullets into one list', () => {
    expect(toBlocks('- a\n- b\n- c')).toEqual([
      { type: 'list', lines: ['a', 'b', 'c'] },
    ]);
  });

  test('separates a paragraph from a following list', () => {
    expect(toBlocks('Try this:\n- swings\n- get-ups')).toEqual([
      { type: 'paragraph', lines: ['Try this:'] },
      { type: 'list', lines: ['swings', 'get-ups'] },
    ]);
  });

  test('drops blank lines rather than emitting empty blocks', () => {
    expect(toBlocks('one\n\n\ntwo')).toEqual([
      { type: 'paragraph', lines: ['one', 'two'] },
    ]);
  });

  test('empty input yields no blocks', () => {
    expect(toBlocks('   ')).toEqual([]);
  });
});

describe('MarkdownLite', () => {
  test('renders bullets as list items', () => {
    render(<MarkdownLite content={'- swings\n- get-ups'} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  test('renders bold and inline code', () => {
    const { container } = render(
      <MarkdownLite content={'Go **heavy** on `swings`'} />,
    );
    expect(container.querySelector('strong')).toHaveTextContent('heavy');
    expect(container.querySelector('code')).toHaveTextContent('swings');
  });

  test('does not interpret HTML in model output', () => {
    const { container } = render(
      <MarkdownLite content={'<img src=x onerror=alert(1)>'} />,
    );
    // Rendered as text, never as markup — there is no innerHTML path here.
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  test('leaves an unmatched asterisk alone instead of mangling it', () => {
    const { container } = render(<MarkdownLite content={'2 ** 3 sets'} />);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toBe('2 ** 3 sets');
  });
});
