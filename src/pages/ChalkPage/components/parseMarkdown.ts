/**
 * Block parsing for `MarkdownLite`. Lives apart from the component so the
 * component file exports only components (react-refresh), and so the parser is
 * unit-testable without rendering.
 */

export interface MarkdownBlock {
  type: 'paragraph' | 'list';
  lines: string[];
}

/** Groups consecutive "- " lines into one list; everything else is a paragraph. */
export const toBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const isBullet = /^\s*-\s+/.test(line);
    const previous = blocks[blocks.length - 1];

    if (isBullet) {
      const item = line.replace(/^\s*-\s+/, '');
      if (previous?.type === 'list') previous.lines.push(item);
      else blocks.push({ type: 'list', lines: [item] });
      continue;
    }

    if (previous?.type === 'paragraph') previous.lines.push(line);
    else blocks.push({ type: 'paragraph', lines: [line] });
  }

  return blocks;
};
