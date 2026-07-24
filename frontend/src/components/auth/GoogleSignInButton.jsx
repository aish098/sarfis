import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentityScript } from '../../utils/googleLoader';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function GoogleSignInButton({ onCredentialReceived, disabled }) {
  const buttonRef = useRef(null);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [scriptError, setScriptError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initGoogle() {
      try {
        setScriptError('');
        const google = await loadGoogleIdentityScript();
        if (cancelled || !buttonRef.current || !google?.accounts?.id) return;

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId || clientId.includes('example.apps.googleusercontent.com')) {
          setScriptError('Google OAuth Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in frontend/.env');
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
          setScriptError('Google Sign-In unavailable');
          setScriptLoading(false);
        }
      }
    }

    initGoogle();

    return () => {
      cancelled = true;
    };
  }, [onCredentialReceived]);

  if (scriptError) {
    return (
      <div className="w-full py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
        <ShieldAlert size={14} className="text-amber-500" />
        <span>{scriptError}</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {scriptLoading && (
        <div className="w-full h-[40px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold">
          <Loader2 size={14} className="animate-spin text-emerald-600" />
          <span>Loading Google Services...</span>
        </div>
      )}
      <div 
        ref={buttonRef} 
        className={`google-sign-in-container w-full flex justify-center overflow-hidden transition-opacity ${scriptLoading || disabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
      />
    </div>
  );
}
