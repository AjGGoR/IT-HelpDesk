import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

// Reusable, accessible confirmation dialog used before destructive/irreversible
// actions (deactivating a user, changing a role, resolving/closing a ticket).
// Controlled component: the caller owns the `open` boolean and decides what
// happens on confirm/cancel (e.g. calling a mutation, or reverting a pending
// <select> value).

export type ConfirmDialogVariant = 'primary' | 'danger';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  // Optional extra content (e.g. a required text field) rendered above the
  // buttons; focus moves to its first focusable element when the dialog opens.
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const CANCEL_BUTTON_CLASSES =
  'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

const CONFIRM_BUTTON_CLASSES: Record<ConfirmDialogVariant, string> = {
  primary:
    'rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500',
  danger:
    'rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let dialogIdCounter = 0;

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  variant = 'primary',
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const idsRef = useRef<{ title: string; message: string } | null>(null);
  if (!idsRef.current) {
    const suffix = ++dialogIdCounter;
    idsRef.current = { title: `confirm-dialog-title-${suffix}`, message: `confirm-dialog-message-${suffix}` };
  }
  const { title: titleId, message: messageId } = idsRef.current;

  // Focus management: remember whatever had focus before the dialog opened,
  // move focus inside the dialog while it's open, and give it back to the
  // trigger element on every close path (confirm, cancel, Escape, backdrop -
  // they all flow through the parent setting `open` back to false, which
  // unmounts this component below and runs this cleanup).
  useEffect(() => {
    if (!open) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const dialogNode = dialogRef.current;
    const focusable = dialogNode?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const target = focusable && focusable.length > 0 ? focusable[0] : dialogNode;
    target?.focus();

    return () => {
      previouslyFocusedElementRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialogNode = dialogRef.current;
    if (!dialogNode) return;
    const focusable = Array.from(dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel();
  };

  return (
    <div
      data-testid="confirm-dialog-backdrop"
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={handleBackdropClick}
    >
      {/*
        jsx-a11y doesn't recognize `role="dialog"` as an interactive role, so it
        flags the onKeyDown handler below. It implements the standard WAI-ARIA
        dialog pattern (Escape to close, Tab focus-trapping) and is the correct,
        accessible way to handle keyboard interaction for a modal.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full ${children ? 'max-w-lg' : 'max-w-sm'} rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {message}
        </p>
        {children}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={CANCEL_BUTTON_CLASSES}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`${CONFIRM_BUTTON_CLASSES[variant]} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
