'use client';

import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Wrap children in a `p-6` body. Default true (the title+body use case).
   * Set false for modals that render their own full-width header/body/footer
   * sections (so their borders span the card edge-to-edge).
   */
  padded?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'lg',
  padded = true,
}) => {
  const visible = open ?? isOpen ?? false;
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!visible) return;

    // Remember what had focus, then move focus into the modal.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      // Trap focus within the modal.
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Restore focus to whatever opened the modal.
      previouslyFocused.current?.focus?.();
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-xl border border-[#DDE3EE] bg-white shadow-2xl outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#DDE3EE] px-6 py-4">
            <h2 className="text-lg font-semibold text-[#0A1628]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[#5B6E8C] hover:bg-[#F5F7FA] hover:text-[#0A1628]"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {padded ? <div className="p-6">{children}</div> : children}
      </div>
    </div>
  );
};

export default Modal;
