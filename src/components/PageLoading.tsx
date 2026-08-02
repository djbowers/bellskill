import { KettlebellGlyph } from './KettlebellGlyph';

export const PageLoading = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60dvh] flex-col items-center justify-center animate-in fade-in"
  >
    <KettlebellGlyph className="h-6 w-6 origin-[50%_17%] fill-primary motion-safe:animate-swing motion-reduce:animate-pulse" />
    <span className="sr-only">Loading…</span>
  </div>
);
