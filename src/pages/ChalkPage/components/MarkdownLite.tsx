import { Fragment, ReactNode } from 'react';

import { toBlocks } from './parseMarkdown';

/**
 * The smallest markdown renderer that covers what Chalk actually emits.
 *
 * The system prompt constrains replies to short prose with the occasional
 * "- " list, so the full markdown surface is not needed — and skipping the
 * dependency keeps a PWA that currently ships no markdown parser that way.
 * Crucially this never touches `dangerouslySetInnerHTML`, so model output has
 * no path to injecting HTML.
 *
 * Handles: paragraphs, "- " lists, **bold**, `code`.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

const renderInline = (text: string): ReactNode[] =>
  text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-muted px-0.5 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });

export const MarkdownLite = ({ content }: { content: string }) => (
  <>
    {toBlocks(content).map((block, i) =>
      block.type === 'list' ? (
        <ul key={i} className="list-disc pl-2">
          {block.lines.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      ) : (
        <p key={i} className="whitespace-pre-wrap">
          {renderInline(block.lines.join('\n'))}
        </p>
      ),
    )}
  </>
);
