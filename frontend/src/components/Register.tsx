import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '../../assets/images/UCV.png';
import { GoogleIcon, MicrosoftIcon } from './icons/BrandIcons';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register, loginWithGoogle, loginWithMicrosoft } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register(name, email, password, confirmPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(
        (err && typeof err === 'object' && 'response' in err && (err as any).response?.data?.error) ||
        (err instanceof Error ? err.message : 'Failed to register')
      );
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'Failed to connect with Google')
      );
    }
  };

  const handleMicrosoftSignup = async () => {
    try {
      await loginWithMicrosoft();
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'Failed to connect with Microsoft')
      );
    }
  };

  return (
    <div className="min-h-screen bg-ucv-surface flex items-center justify-center py-16 px-6">
      <div className="w-full max-w-[420px] bg-white border border-ucv-border rounded-lg p-9 shadow-sm">
        <div className="flex items-center gap-2 justify-center mb-7">
          <img src={logoImage} alt="logo" className="w-[26px] h-[26px] object-contain" />
          <span className="font-bold text-base text-ucv-text">Unified Calendar View</span>
        </div>
        <h1 className="text-[22px] font-bold text-center text-ucv-text mb-1.5">Create your account</h1>
        <p className="text-ucv-text-muted text-sm text-center mb-7">Start syncing your calendars in minutes.</p>

        {error && (
          <div className="w-full mb-5 p-3 rounded-lg bg-ucv-danger-light border border-ucv-danger-border text-ucv-danger text-sm">
            {error}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="w-full space-y-2.5 mb-6">
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full bg-white border border-ucv-border py-2.5 rounded-lg text-sm font-semibold text-ucv-text flex items-center justify-center gap-2.5 hover:bg-ucv-surface hover:border-ucv-text-disabled transition-colors"
          >
            <GoogleIcon size={18} />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleMicrosoftSignup}
            className="w-full bg-white border border-ucv-border py-2.5 rounded-lg text-sm font-semibold text-ucv-text flex items-center justify-center gap-2.5 hover:bg-ucv-surface hover:border-ucv-text-disabled transition-colors"
          >
            <MicrosoftIcon size={16} />
            Continue with Microsoft
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-ucv-border" />
          <span className="text-ucv-text-faint text-sm">or</span>
          <div className="flex-1 h-px bg-ucv-border" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="w-full">
          <label htmlFor="name" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Full Name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-3 py-2.5 border border-ucv-border rounded-lg text-sm mb-4 text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light"
          />

          <label htmlFor="email" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-3 py-2.5 border border-ucv-border rounded-lg text-sm mb-4 text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light"
          />

          <label htmlFor="password" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2.5 border border-ucv-border rounded-lg text-sm mb-4 text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light"
          />

          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2.5 border border-ucv-border rounded-lg text-sm mb-6 text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light"
          />

          <button
            type="submit"
            className="w-full bg-ucv-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-ucv-primary-hover transition-colors mb-6"
          >
            Create Account
          </button>

          <p className="text-center text-sm text-ucv-text-muted">
            Already have an account?{' '}
            <RouterLink to="/login" className="font-semibold text-ucv-primary hover:underline">
              Sign in
            </RouterLink>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
