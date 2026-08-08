import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    const error = searchParams.get('error');
    
    if (error) {
      console.error('OAuth error:', error);
      navigate('/login', { 
        state: { error: 'Authentication failed. Please try again.' } 
      });
      return;
    }

    // Wait a moment for the auth context to update after OAuth callback
    const timer = setTimeout(() => {
      if (user) {
        navigate('/dashboard');
      } else {
        // If still no user after timeout, something went wrong
        navigate('/login', {
          state: { error: 'Authentication verification failed' }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate, searchParams, user]);

  return (
    <div className="min-h-screen bg-ucv-surface flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center bg-white border border-ucv-border rounded-lg p-12 shadow-sm">
        <div className="w-14 h-14 border-4 border-ucv-primary-light border-t-ucv-primary rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-xl font-bold text-ucv-text mb-2">Completing Authentication</h1>
        <p className="text-sm text-ucv-text-muted">Please wait while we verify your credentials...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;