import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { PaymentResult } from './types';
import { createCheckoutSession } from './api';

export interface BCHPayButtonProps {
  merchant: string;
  amount: number;
  memo?: string;
  apiKey?: string;
  apiUrl?: string;
  buttonText?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonSize?: 'small' | 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
  onSuccess?: (data: PaymentResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

const BCH_LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#0AC18E"/>
  <path d="M21.2 13.6c.4-2.6-1.6-4-4.3-4.9l.9-3.5-2.1-.5-.8 3.4c-.6-.1-1.1-.3-1.7-.4l.9-3.4-2.1-.5-.9 3.5c-.5-.1-.9-.2-1.4-.3l-2.9-.7-.6 2.2s1.6.4 1.5.4c.9.2 1 .8 1 1.2l-1 4.1c.1 0 .1 0 .2.1h-.2l-1.4 5.8c-.1.3-.4.7-.9.6 0 0-1.5-.4-1.5-.4l-1 2.4 2.7.7c.5.1 1 .3 1.5.4l-.9 3.5 2.1.5.9-3.5c.6.2 1.1.3 1.7.4l-.9 3.5 2.1.5.9-3.5c3.7.7 6.5.4 7.7-2.9.9-2.7 0-4.2-2-5.2 1.4-.3 2.5-1.3 2.8-3.2zm-5 7c-.7 2.7-5.2 1.2-6.6.9l1.2-4.7c1.5.4 6.1 1.1 5.4 3.8zm.7-7c-.6 2.4-4.4 1.2-5.6.9l1.1-4.3c1.2.3 5.2.9 4.5 3.4z" fill="white"/>
</svg>`;

const SIZES = {
  small: { padding: '8px 16px', fontSize: '13px', gap: '6px' },
  medium: { padding: '12px 24px', fontSize: '15px', gap: '8px' },
  large: { padding: '16px 32px', fontSize: '17px', gap: '10px' },
};

export function BCHPayButton({
  merchant,
  amount,
  memo,
  apiKey,
  apiUrl,
  buttonText = 'Pay with BCH',
  buttonColor = '#0AC18E',
  buttonTextColor = '#fff',
  buttonSize = 'medium',
  className,
  style,
  onSuccess,
  onError,
  onCancel,
  children,
}: BCHPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);

  // Cleanup message listener on unmount
  useEffect(() => {
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
    };
  }, []);

  const closeModal = useCallback(() => {
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    setModalUrl(null);
  }, []);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      let checkoutUrl: string;

      if (!apiKey) {
        // Direct payment link flow
        const base = apiUrl || '';
        checkoutUrl = `${base}/pay/${merchant}?amount=${amount}`;
      } else {
        // Checkout session flow
        const session = await createCheckoutSession(apiKey, amount, {
          memo,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
          apiUrl,
        });
        checkoutUrl = session.checkout_url;
      }

      // Add embed query param
      const url = new URL(checkoutUrl, window.location.origin);
      url.searchParams.set('embed', 'true');

      // Set up postMessage listener
      const handler = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return;
        if (event.data.type === 'bchpay:success') {
          closeModal();
          onSuccess?.(event.data.payload);
        } else if (event.data.type === 'bchpay:cancel') {
          closeModal();
          onCancel?.();
        } else if (event.data.type === 'bchpay:error') {
          closeModal();
          onError?.(new Error(event.data.message || 'Payment failed'));
        }
      };

      messageHandlerRef.current = handler;
      window.addEventListener('message', handler);

      setModalUrl(url.toString());
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [merchant, amount, memo, apiKey, apiUrl, onSuccess, onError, onCancel, closeModal]);

  const s = SIZES[buttonSize];

  const defaultButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: s.gap,
    padding: s.padding,
    fontSize: s.fontSize,
    background: buttonColor,
    color: buttonTextColor,
    border: 'none',
    borderRadius: '10px',
    cursor: loading ? 'wait' : 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 600,
    lineHeight: 1,
    opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.15s, transform 0.1s',
    ...style,
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={children ? style : defaultButtonStyle}
      >
        {children || (
          <>
            <span dangerouslySetInnerHTML={{ __html: BCH_LOGO_SVG }} />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {modalUrl && typeof document !== 'undefined' &&
        createPortal(
          <Modal
            url={modalUrl}
            onClose={() => {
              closeModal();
              onCancel?.();
            }}
          />,
          document.body
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal overlay component
// ---------------------------------------------------------------------------

function Modal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.6)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'bchpay-react-fade-in 0.2s ease',
      }}
    >
      <style>{`
        @keyframes bchpay-react-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          width: '420px',
          maxWidth: '95vw',
          height: '680px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            zIndex: 10,
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            lineHeight: 1,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
          }}
        >
          &times;
        </button>
        <iframe
          src={url}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="BCH Pay Checkout"
        />
      </div>
    </div>
  );
}

export type { PaymentResult } from './types';
