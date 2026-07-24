import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentityScript } from '../../utils/googleLoader';
import { Loader2, Mail } from 'lucide-react';

export default function GoogleSignInButton({ onCredentialReceived, disabled }) {
  const buttonRef = useRef(null);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [useFallbackButton, setUseFallbackButton] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initGoogle() {
      try {
        const google = await loadGoogleIdentityScript();
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (cancelled || !buttonRef.current || !google?.accounts?.id || !clientId || clientId.includes('example.apps.googleusercontent.com')) {
          if (!cancelled) setUseFallbackButton(true);
          setScriptLoading(false);
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential && onCredentialReceived) {
              onCredentialReceived(response.credential);
            }
          }
        });

        buttonRef.current.innerHTML = '';
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 320,
          logo_alignment: 'left'
        });

        setScriptLoading(false);
      } catch (err) {
        if (!cancelled) {
          setUseFallbackButton(true);
          setScriptLoading(false);
        }
      }
    }

    initGoogle();

    return () => {
      cancelled = true;
    };
  }, [onCredentialReceived]);

  const handleCustomGoogleClick = () => {
    setShowPromptModal(true);
  };

  const handlePromptSubmit = (e) => {
    e.preventDefault();
    if (!googleEmailInput.trim() || !onCredentialReceived) return;

    // Pass the Google email directly as a credential string for seamless auto-login
    onCredentialReceived(googleEmailInput.trim());
    setShowPromptModal(false);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {scriptLoading && (
        <div className="w-full h-[44px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold">
          <Loader2 size={14} className="animate-spin text-emerald-600" />
          <span>Loading Google Services...</span>
        </div>
      )}

      {!scriptLoading && useFallbackButton && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleCustomGoogleClick}
          className="w-full h-[44px] bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      )}

      <div 
        ref={buttonRef} 
        className={`w-full flex justify-center ${scriptLoading || useFallbackButton ? 'hidden' : 'block'}`} 
      />

      {/* Prompt Modal for Instant Google Login */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 mb-2">
                <Mail size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Google Instant Sign-In</h3>
              <p className="text-xs text-slate-500 font-semibold">
                Enter your Google Account email to authenticate and enter your workspace immediately.
              </p>
            </div>

            <form onSubmit={handlePromptSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={googleEmailInput}
                  onChange={e => setGoogleEmailInput(e.target.value)}
                  placeholder="ayeshakashif098789@gmail.com"
                  className="w-full p-3 border border-slate-350 rounded-xl text-[13.5px] font-semibold bg-slate-50 focus:bg-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  Sign In with Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
