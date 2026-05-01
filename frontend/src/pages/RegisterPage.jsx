import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { AuthLayout, AuthInput, AuthButton, AuthError, AuthWrapper, AuthSelect } from './Auth';

const ROLE_DESCRIPTIONS = {
  'Company Admin': 'Full access: manage users, settings, and all financial data.',
  'Accountant': 'Post journal entries, manage ledger, view all reports.',
  'Viewer': 'Read-only access to financial reports and dashboards.',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'Accountant'
  });

  // — logic unchanged —
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await register(formData.name, formData.email, formData.password, formData.role);
    if (success) navigate('/dashboard');
  };

  const subtitle = (
    <>Already have an account?{' '}
      <Link to="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition">
        Sign in here
      </Link>
    </>
  );

  return (
    <AuthLayout title="Create your account" subtitle={subtitle}>
      <AuthWrapper>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <AuthError error={error} />
          <AuthInput id="name" name="name" type="text"
            label="Full Name" value={formData.name}
            onChange={handleChange} placeholder="Jane Doe" />
          <AuthInput id="email" name="email" type="email"
            label="Email Address" value={formData.email}
            onChange={handleChange} placeholder="name@company.com" />
          <AuthInput id="password" name="password" type="password"
            label="Password" value={formData.password}
            onChange={handleChange} placeholder="Minimum 8 characters" />
          <AuthSelect id="role" name="role" label="I am a..."
            value={formData.role} onChange={handleChange}>
            <option value="Company Admin" className="bg-slate-900">Company Admin (Full Access)</option>
            <option value="Accountant" className="bg-slate-900">Accountant (Transaction Management)</option>
            <option value="Viewer" className="bg-slate-900">Viewer (Reports Only)</option>
          </AuthSelect>
          {/* Dynamic role hint — visual only */}
          <p className="text-xs text-slate-500 -mt-2 ml-1 leading-relaxed">
            {ROLE_DESCRIPTIONS[formData.role]}
          </p>
          <div className="pt-2">
            <AuthButton isLoading={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </AuthButton>
          </div>
        </form>
      </AuthWrapper>
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>AES-256 encrypted · No credit card required · Cancel anytime</span>
      </div>
    </AuthLayout>
  );
}
