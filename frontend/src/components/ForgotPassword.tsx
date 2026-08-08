import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { ArrowLeft, Mail, Lock } from 'lucide-react';
import logoImage from '../../assets/images/UCV.png';

const API_URL = import.meta.env.VITE_API_URL;

// Step 1: Email input
// Step 2: OTP verification
// Step 3: New password

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setSuccess('OTP sent to your email successfully!');
      setTimeout(() => {
        setStep(2);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);
  };

  // Handle OTP verification
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp: otpString }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setResetToken(data.resetToken);
      setSuccess('OTP verified successfully!');
      setTimeout(() => {
        setStep(3);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          newPassword,
          confirmNewPassword: confirmPassword,
          resetToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full px-3 py-2.5 border border-ucv-border rounded-lg text-sm text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light";
  const primaryButtonClasses = "w-full bg-ucv-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-ucv-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={handleEmailSubmit} className="w-full">
            <p className="text-sm text-ucv-text-muted text-center mb-6">
              Enter your email address and we'll send you a 6-digit verification code to reset your password.
            </p>
            <label htmlFor="email" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Email</label>
            <div className="relative mb-6">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ucv-primary" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`${inputClasses} pl-10`}
              />
            </div>
            <button type="submit" disabled={loading} className={primaryButtonClasses}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        );

      case 2:
        return (
          <form onSubmit={handleOtpSubmit} className="w-full">
            <p className="text-sm text-ucv-text-muted text-center mb-6">
              We've sent a 6-digit verification code to <strong className="text-ucv-text">{email}</strong>
            </p>
            <div className="flex gap-2 justify-center mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onPaste={index === 0 ? handleOtpPaste : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && index > 0) {
                      const prevInput = document.getElementById(`otp-${index - 1}`);
                      prevInput?.focus();
                    }
                  }}
                  maxLength={1}
                  className="w-11 h-[52px] text-center border border-ucv-border rounded-lg text-xl font-bold text-ucv-text focus:outline-none focus:border-ucv-primary focus:ring-2 focus:ring-ucv-primary-light"
                />
              ))}
            </div>
            <button type="submit" disabled={loading || otp.join('').length !== 6} className={`${primaryButtonClasses} mb-2`}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-ucv-text-muted text-sm py-2 hover:text-ucv-primary transition-colors"
            >
              Change Email
            </button>
          </form>
        );

      case 3:
        return (
          <form onSubmit={handlePasswordReset} className="w-full">
            <p className="text-sm text-ucv-text-muted text-center mb-6">
              Create a new password for your account
            </p>
            <label htmlFor="newPassword" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">New Password</label>
            <div className="relative mb-4">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ucv-primary" />
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClasses} pl-10`}
              />
            </div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-ucv-text-secondary mb-1.5">Confirm New Password</label>
            <div className="relative mb-6">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ucv-primary" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClasses} pl-10`}
              />
            </div>
            <button type="submit" disabled={loading} className={primaryButtonClasses}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-ucv-surface flex items-center justify-center py-16 px-6">
      <div className="w-full max-w-[420px] bg-white border border-ucv-border rounded-lg p-9 shadow-sm">
        <div className="flex items-center gap-2 justify-center mb-7">
          <img src={logoImage} alt="logo" className="w-[26px] h-[26px] object-contain" />
          <span className="font-bold text-base text-ucv-text">Unified Calendar View</span>
        </div>
        <h1 className="text-[22px] font-bold text-center text-ucv-text mb-1.5">
          {step === 1 && 'Reset your password'}
          {step === 2 && 'Check your email'}
          {step === 3 && 'New Password'}
        </h1>
        <p className="text-ucv-text-muted text-sm text-center mb-7">
          {step === 1 && "No worries, we'll help you reset it"}
          {step === 2 && 'Check your email for the code'}
          {step === 3 && 'Choose a strong password'}
        </p>

        {error && (
          <div className="w-full mb-5 p-3 rounded-lg bg-ucv-danger-light border border-ucv-danger-border text-ucv-danger text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="w-full mb-5 p-3 rounded-lg bg-ucv-green-light border border-ucv-green/30 text-ucv-green text-sm">
            {success}
          </div>
        )}

        {renderStepContent()}

        <div className="text-center mt-6">
          <RouterLink
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-ucv-text-muted hover:text-ucv-primary transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Login
          </RouterLink>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
