import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Building2, Check, ArrowRight, ShieldAlert, Plus, RefreshCw } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { AuthLayout, AuthInput, AuthButton, AuthError, AuthWrapper } from './Auth';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, createWorkspaceWithGoogle, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '', companySlug: '' });
  const [workspaceSelection, setWorkspaceSelection] = useState(null); // { userCompanies, credential }
  const [unauthorizedModal, setUnauthorizedModal] = useState(null); // { email, credential, message }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(formData.email, formData.password);
    if (success) navigate('/dashboard');
  };

  const handleGoogleCredential = async (credential) => {
    setUnauthorizedModal(null);
    const res = await loginWithGoogle({
      credential,
      companySlug: formData.companySlug
    });

    if (res?.requireWorkspaceSelection) {
      setWorkspaceSelection({
        userCompanies: res.userCompanies,
        credential,
        profile: res.profile
      });
    } else if (res?.code === 'ACCOUNT_NOT_AUTHORIZED' || res?.error?.includes('not authorized')) {
      setUnauthorizedModal({
        email: res.email || 'ayeshakashif098789@gmail.com',
        credential,
        message: res.error || 'This Google account is not authorized for any active workspace. Please ask your administrator for an invitation.'
      });
    } else if (res?.success) {
      navigate('/dashboard');
    }
  };

  const handleCreateWorkspaceWithGoogle = async () => {
    if (!unauthorizedModal?.credential) return;
    const res = await createWorkspaceWithGoogle({
      credential: unauthorizedModal.credential
    });
    if (res?.success) {
      setUnauthorizedModal(null);
      navigate('/dashboard');
    }
  };

  const handleSelectWorkspace = async (slug) => {
    if (!workspaceSelection?.credential) return;
    const res = await loginWithGoogle({
      credential: workspaceSelection.credential,
      companySlug: slug
    });
    if (res?.success) {
      setWorkspaceSelection(null);
      navigate('/dashboard');
    }
  };

  const subtitle = (
    <>Or{' '}
      <Link to="/register" className="font-bold text-emerald-400 hover:text-emerald-300 transition">
        start your 14-day free trial
      </Link>
    </>
  );

  return (
    <AuthLayout title="Sign in to ACCOUNTELLENCE ERP" subtitle={subtitle}>
      <AuthWrapper>
        {/* Multi-Workspace Selection Modal Overlay */}
        {workspaceSelection && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 mb-2">
                  <Building2 size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Select Workspace</h3>
                <p className="text-slate-500 text-xs">
                  Your Google account ({workspaceSelection.profile?.email}) belongs to multiple active company workspaces.
                </p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {workspaceSelection.userCompanies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectWorkspace(c.slug)}
                    className="w-full p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 size={18} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      <div>
                        <div className="font-bold text-xs text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Role: {c.role || 'Member'}</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setWorkspaceSelection(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer border-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* StealthWriter Style Google Account Authorization Modal Overlay */}
        {unauthorizedModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-600 mb-1 shadow-xs">
                  <ShieldAlert size={28} />
                </div>
                <span className="inline-block px-3 py-1 bg-amber-100/60 text-amber-900 border border-amber-200/80 rounded-full text-[11px] font-extrabold tracking-wide">
                  {unauthorizedModal.email}
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                  Workspace Authorization Required
                </h3>
                <p className="text-slate-600 text-xs font-semibold px-2 leading-relaxed">
                  This Google account is not authorized for any active workspace. Please ask your administrator for an invitation.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                  What would you like to do?
                </span>
                <button
                  onClick={handleCreateWorkspaceWithGoogle}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={16} />}
                  <span>Create New Company Workspace</span>
                </button>
              </div>

              <button
                onClick={() => setUnauthorizedModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border-none"
              >
                Try Another Account
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <AuthError error={error} />

          {/* Google SSO Button Wrapper */}
          <div className="space-y-3">
            <GoogleSignInButton onCredentialReceived={handleGoogleCredential} disabled={isLoading} />
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-700 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase font-black tracking-widest text-slate-400 absolute">
              OR SIGN IN WITH EMAIL
            </span>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AuthInput
              id="companySlug"
              name="companySlug"
              type="text"
              label="Workspace Code / Slug (Optional)"
              value={formData.companySlug}
              onChange={handleChange}
              placeholder="e.g. accountellence"
            />
            <AuthInput
              id="email"
              name="email"
              type="email"
              label="Email address"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@company.com"
            />
            <AuthInput
              id="password"
              name="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
            <div className="flex items-center justify-between">
              <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input 
                  id="remember-me"
                  name="remember"
                  type="checkbox" 
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500" 
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
                Forgot password?
              </a>
            </div>
            <div className="pt-2">
              <AuthButton isLoading={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </AuthButton>
            </div>
          </form>
        </div>
      </AuthWrapper>

      {/* Trust badge */}
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>AES-256 encrypted · SOC 2 compliant · IFRS/GAAP certified</span>
      </div>
    </AuthLayout>
  );
}
