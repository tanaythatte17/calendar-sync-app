import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
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
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 4,
            padding: 6,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <CircularProgress
            size={60}
            sx={{
              color: '#667eea',
              mb: 3,
            }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: '#333',
              mb: 2,
            }}
          >
            Completing Authentication
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
            }}
          >
            Please wait while we verify your credentials...
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default AuthSuccess;