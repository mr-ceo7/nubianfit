import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const GOOGLE_CLIENT_ID = '362855101903-ncu3jd9sa2vv3v613uick1llf8qikl28.apps.googleusercontent.com';

interface GoogleAuthProps {
  onError?: (err: string) => void;
  promptOneTap?: boolean;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({
  onError,
  promptOneTap = true,
  text = 'continue_with',
}) => {
  const { loginWithGoogle } = useAuth();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const initGsi = () => {
      if (!window.google?.accounts?.id) return false;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response.credential) return;
            setLoading(true);
            try {
              await loginWithGoogle(response.credential);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Google authentication failed';
              onError?.(msg);
            } finally {
              setLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        });

        // Render official button in container if present
        if (buttonContainerRef.current) {
          buttonContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text,
            shape: 'rectangular',
            logo_alignment: 'left',
            width: '100%',
          });
        }

        // Trigger Google One Tap
        if (promptOneTap) {
          window.google.accounts.id.prompt();
        }

        setSdkReady(true);
        return true;
      } catch (err) {
        console.warn('Google Identity Services init warning:', err);
        return false;
      }
    };

    if (!initGsi()) {
      checkInterval = setInterval(() => {
        attempts++;
        if (initGsi() || attempts > 20) {
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [loginWithGoogle, onError, promptOneTap, text]);

  return (
    <div className="w-full">
      <div
        ref={buttonContainerRef}
        className="w-full min-h-[44px] flex items-center justify-center overflow-hidden rounded-xl"
        data-testid="google-auth-button-container"
      />
      {(!sdkReady || loading) && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            } else {
              onError?.('Google Identity Services is loading. Please check your internet connection or try again.');
            }
          }}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-900 text-sm font-semibold text-white transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.31 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.17 0 9.97 0 12s.46 3.83 1.26 5.42l4.02-3.13z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>{loading ? 'Signing in with Google…' : 'Continue with Google'}</span>
        </button>
      )}
    </div>
  );
};
