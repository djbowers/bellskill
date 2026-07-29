import { useEffect, useState } from 'react';

// Non-text input types never raise a soft keyboard, so focusing them should not
// hide the bar.
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const isTextInput = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type);
  }
  return false;
};

// Above URL-bar show/hide deltas, below any soft-keyboard height.
const KEYBOARD_HEIGHT_THRESHOLD = 100;

/**
 * True while the mobile soft keyboard is open. Used to hide the fixed bottom
 * bar, which iOS Safari otherwise floats above the keyboard on top of the
 * field being edited.
 *
 * Primary signal is the VisualViewport API — the keyboard shrinks the visual
 * viewport but not the layout viewport, so a large height gap means it is
 * open. This also catches swipe-dismiss (no blur fires) and correctly ignores
 * hardware keyboards. Environments without `visualViewport` (jsdom, legacy
 * browsers) fall back to a text-input focus heuristic.
 */
export const useIsKeyboardOpen = (): boolean => {
  const [isFocusedOnText, setIsFocusedOnText] = useState(false);
  const [isViewportShrunk, setIsViewportShrunk] = useState(false);
  const hasVisualViewport =
    typeof window !== 'undefined' && !!window.visualViewport;

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (isTextInput(event.target)) setIsFocusedOnText(true);
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (!isTextInput(event.target)) return;
      // Focus moving straight to another text input keeps the keyboard up, so
      // stay open to avoid the bar flickering back for a frame between fields.
      if (isTextInput(event.relatedTarget)) return;
      setIsFocusedOnText(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let frame = 0;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setIsViewportShrunk(
          window.innerHeight - visualViewport.height >
            KEYBOARD_HEIGHT_THRESHOLD,
        );
      });
    };

    handleResize();
    visualViewport.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return hasVisualViewport ? isViewportShrunk : isFocusedOnText;
};
