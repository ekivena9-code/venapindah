import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

const Modal: React.FC<ModalProps> = React.memo(({ isOpen, onClose, title, children, footer, size = '2xl' }) => {

  // Enhanced keyboard and body scroll handling
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = 'var(--scrollbar-width, 0px)';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm w-full',
    md: 'max-w-md w-full',
    lg: 'max-w-lg w-full',
    xl: 'max-w-xl w-full',
    '2xl': 'max-w-2xl w-full',
    '3xl': 'max-w-3xl w-full',
    '4xl': 'max-w-4xl w-full',
    '5xl': 'max-w-5xl w-full',
  };

  return createPortal(
    <div
      className="app-modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center transition-all duration-300 xl:items-start"
      style={{
        zIndex: isOpen ? 60 : -1,
        padding: 'calc(1rem + var(--safe-area-inset-top, 0px)) calc(1rem + var(--safe-area-inset-right, 0px)) calc(1rem + var(--safe-area-inset-bottom, 0px)) calc(1rem + var(--safe-area-inset-left, 0px))',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`
          app-modal-dialog bg-brand-surface text-brand-text-primary 
          rounded-2xl sm:rounded-3xl 
          shadow-2xl 
          ${sizeClasses[size]} 
          flex flex-col 
          transform transition-all duration-300 
          animate-scale-in 
          border border-brand-border/50
          backdrop-blur-xl
        `}
        style={{
          maxHeight: 'calc(100dvh - 2rem - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Enhanced Header with better mobile spacing */}
        <div className="
          flex justify-between items-center 
          p-2.5 sm:p-6 
          border-b border-brand-border/50 
          flex-shrink-0
          bg-brand-surface/90 backdrop-blur-sm
          rounded-t-xl sm:rounded-t-3xl
        ">
          <h3
            id="modal-title"
            className="
              text-base sm:text-xl 
              font-bold 
              text-brand-text-light
              min-w-0
              break-words leading-snug
              pr-2
            "
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="
              text-red-400
              hover:text-white
              active:text-white
              p-1 sm:p-2
              rounded-full 
              bg-red-500/10
              hover:bg-red-500
              active:bg-red-600
              transition-all duration-200
              flex-shrink-0
              w-11 h-11 min-w-[44px] min-h-[44px]
              flex items-center justify-center
              focus:outline-none
              mobile-touch-target mobile-touch-target-icon
              focus:ring-2 focus:ring-red-500/30
            "
            aria-label="Close modal"
            type="button"
          >
            <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Enhanced Content Area with better scrolling */}
        <div className="
          p-2 sm:p-6 
          overflow-y-auto 
          flex-1
          modal-content-area
          overscroll-contain
          scroll-smooth
        "
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'
          }}>
          {children}
        </div>

        {/* Enhanced Footer */}
        {footer && (
          <div className="
            flex justify-end items-center 
            p-2 sm:p-6 
            app-modal-footer
            bg-brand-bg/50 
            border-t border-brand-border/50 
            rounded-b-xl sm:rounded-b-3xl 
            flex-shrink-0
            backdrop-blur-sm
            gap-2 sm:gap-3
          ">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scaleIn {
          from { 
            transform: scale(0.95) translateY(10px); 
            opacity: 0; 
          }
          to { 
            transform: scale(1) translateY(0); 
            opacity: 1; 
          }
        }
        
        .animate-scale-in {
          animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        /* ── xl: posisikan dari atas ── */
        @media (min-width: 1280px) {
          .app-modal-overlay {
            align-items: flex-start;
            padding-top: 2rem;
          }
          .app-modal-dialog {
            max-height: calc(100vh - 4rem);
          }
        }

        /* ── Mobile (<= 640px): compact, readable form controls ── */
        @media (max-width: 640px) {
          .app-modal-overlay {
            align-items: flex-start;
            padding: calc(0.5rem + var(--safe-area-inset-top, 0px)) calc(0.5rem + var(--safe-area-inset-right, 0px)) calc(0.5rem + var(--safe-area-inset-bottom, 0px)) calc(0.5rem + var(--safe-area-inset-left, 0px)) !important;
          }

          .app-modal-dialog {
            max-height: calc(100dvh - 1rem - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px)) !important;
            width: 100% !important;
            border-radius: 10px !important; /* ±10px border radius */
            min-width: 0;
            overflow: hidden;
          }

          .app-modal-dialog > div:first-child,
          .modal-content-area,
          .app-modal-footer {
            padding: 0.625rem 0.75rem !important; /* 10px vertical, 12px horizontal */
          }

          .modal-content-area {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding-bottom: 0.75rem !important;
            overflow-x: hidden;
          }

          .app-modal-dialog form {
            min-width: 0;
            max-width: 100%;
          }

          .app-modal-dialog input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]),
          .app-modal-dialog select {
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            min-height: 34px !important;
            height: 34px !important;
            padding: 6px 9px !important;
            font-size: 13px !important;
            line-height: 1.2 !important;
            border-radius: 8px !important;
          }

          .app-modal-dialog input.input-field,
          .app-modal-dialog select.input-field {
            min-height: 36px !important;
            height: 36px !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }

          .app-modal-dialog textarea {
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            min-height: 66px !important;
            height: auto;
            padding: 7px 9px !important;
            font-size: 13px !important;
            line-height: 1.3 !important;
            border-radius: 8px !important;
          }

          .app-modal-dialog form label {
            font-size: 11px !important;
            line-height: 1.25 !important;
          }

          .app-modal-dialog form .input-label {
            font-size: 10px !important;
          }

          .app-modal-dialog .input-group,
          .app-modal-dialog .form-group {
            margin-bottom: 7px !important;
          }

          .app-modal-dialog .modal-content-area form div[class*="justify-end"][class*="border-t"] {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            flex-wrap: wrap;
            gap: 8px !important;
            margin-top: 8px !important;
            padding-top: 8px !important;
          }

          .app-modal-dialog .modal-content-area form div[class*="justify-end"][class*="border-t"] > button:not(.checklist-item-toggle):not(.client-payment-toggle):not(.finance-add-pocket-card):not(.finance-add-account-card):not(.vendor-portfolio-card):not(.btn-box-read):not(.btn-box-edit):not(.btn-box-delete):not(.btn-box-wa):not(.btn-box-add):not(.rounded-full):not([class*="rounded-full"]):not(.bottom-nav button):not([class*="w-7"]):not([class*="w-8"]):not([class*="h-7"]):not([class*="h-8"]):not([class*="w-6"]):not([class*="h-6"]) {
            box-sizing: border-box;
            width: 100% !important;
            min-width: 88px;
            min-height: 42px !important;
            max-height: none !important;
            height: 42px !important;
            padding: 0 14px !important;
            font-size: 13.5px !important;
            line-height: 1.2 !important;
            border-radius: 8px !important;
            white-space: normal;
          }

          .app-modal-dialog .modal-content-area .client-document-toolbar {
            gap: 8px !important;
            max-width: 100%;
          }

          .app-modal-dialog .modal-content-area .client-document-toolbar > .client-document-action:not(.checklist-item-toggle):not(.client-payment-toggle):not(.finance-add-pocket-card):not(.finance-add-account-card):not(.vendor-portfolio-card):not(.btn-box-read):not(.btn-box-edit):not(.btn-box-delete):not(.btn-box-add):not(.rounded-full):not([class*="rounded-full"]):not(.bottom-nav button):not([class*="w-7"]):not([class*="w-8"]):not([class*="h-7"]):not([class*="h-8"]):not([class*="w-6"]):not([class*="h-6"]) {
            box-sizing: border-box;
            width: auto !important;
            max-width: 100%;
            min-width: 36px !important;
            min-height: 36px !important;
            max-height: none !important;
            height: 36px !important;
            padding: 0 10px !important;
            font-size: 13px !important;
            line-height: 1.2 !important;
            border-radius: 8px !important;
            white-space: nowrap;
          }

          .app-modal-dialog .modal-content-area .client-document-toolbar .client-document-action svg {
            width: 16px !important;
            height: 16px !important;
            max-width: 16px !important;
            max-height: 16px !important;
          }

          .app-modal-dialog input[type="checkbox"],
          .app-modal-dialog input[type="radio"] {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
          }

          .app-modal-footer {
            padding-bottom: calc(0.75rem + var(--safe-area-inset-bottom, 0px)) !important;
            gap: 0.5rem;
          }

          .modal-content-area form button[type="submit"],
          .modal-content-area form .button-primary,
          .modal-content-area form .button-secondary,
          .app-modal-footer .button-primary,
          .app-modal-footer .button-secondary,
          .app-modal-footer button {
            box-sizing: border-box;
            min-height: 38px !important;
            max-height: none !important;
            height: 38px !important;
            font-size: 13px !important;
            line-height: 1.2 !important;
            padding: 0 12px !important;
            border-radius: 8px !important;
          }
        }

        /* ── Extra small (< 380px) ── */
        @media (max-width: 379px) {
          .app-modal-dialog {
            max-height: calc(100dvh - 1rem - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px)) !important;
          }
        }
        
        /* Enhanced scrollbar for modal content */
        .modal-content-area::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-content-area::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .modal-content-area::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 3px;
        }
        
        .modal-content-area::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-secondary);
        }
        
        /* iOS specific optimizations */
        @supports (-webkit-touch-callout: none) {
          .modal-content-area {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>,
    document.body
  );
});

export default Modal;