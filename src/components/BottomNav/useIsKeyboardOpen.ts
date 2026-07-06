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

/**
 * True while a text input, textarea, or contenteditable element is focused —
 * i.e. when the mobile soft keyboard is (or is about to be) open. Used to hide
 * the fixed bottom bar, which iOS Safari otherwise floats above the keyboard on
 * top of the field being edited.
 */
export const useIsKeyboardOpen = (): boolean => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (isTextInput(event.target)) setIsOpen(true);
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isTextInput(event.target)) setIsOpen(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isOpen;
};
