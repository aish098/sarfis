import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { AuthLayout, AuthInput, AuthButton, AuthError, AuthWrapper } from './Auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });

  // — logic unchanged —
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(formData.email, formData.password);
    if (success) navigate('/dashboard');
  };

  const subtitle = (
    <>Or{' '}
      <Link to="/register" className="font-bold text-emerald-400 hover:text-emerald-300 transition">
        start your 14-day free trial
      </Link>
    </>
  );

  return (
    <AuthLayout title="Sign in to your account" subtitle={subtitle}>
      <AuthWrapper>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <AuthError error={error} />
          <AuthInput id="email" name="email" type="email"
            label="Email address" value={formData.email}
            onChange={handleChange} placeholder="name@company.com" />
          <AuthInput id="password" name="password" type="password"
            label="Password" value={formData.password}
            onChange={handleChange} placeholder="••••••••" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500" />
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
      </AuthWrapper>

      {/* Trust badge — visual only */}
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>AES-256 encrypted · SOC 2 compliant · IFRS/GAAP certified</span>
      </div>
    </AuthLayout>
  );
}
