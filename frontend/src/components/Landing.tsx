import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <Card sx={{ 
    height: '100%', 
    display: 'flex', 
    flexDirection: 'column',
    borderRadius: 4,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
      transform: 'translateY(-8px)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    }
  }}>
    <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
      <Box sx={{ 
        color: 'primary.main', 
        mb: 3,
        display: 'flex',
        justifyContent: 'center',
        '& > *': { fontSize: 48 }
      }}>
        {icon}
      </Box>
      <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {description}
      </Typography>
    </CardContent>
  </Card>
);

const Landing: React.FC = () => {

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          mb: 8,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3,
          }
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 6 }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h2" 
                component="h1" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2,
                  mb: 3
                }}
              >
                Sync Your Calendars
                <br />
                <span style={{ color: '#fbbf24' }}>Seamlessly</span>
              </Typography>
              <Typography 
                variant="h5" 
                sx={{ 
                  mb: 4, 
                  opacity: 0.9,
                  lineHeight: 1.5,
                  fontWeight: 300
                }}
              >
                Manage all your events across Google and Microsoft calendars in one beautiful, unified interface. Never miss an important meeting again.
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  sx={{
                    bgcolor: '#fbbf24',
                    color: '#1f2937',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    textTransform: 'none',
                    boxShadow: '0 10px 25px rgba(251, 191, 36, 0.3)',
                    '&:hover': {
                      bgcolor: '#f59e0b',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 15px 35px rgba(251, 191, 36, 0.4)',
                    },
                    transition: 'all 0.3s ease-in-out'
                  }}
                >
                  Get Started Free
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  sx={{
                    color: 'white',
                    borderColor: 'white',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'white',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease-in-out'
                  }}
                >
                  Sign In
                </Button>
              </Box>
            </Box>
            
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 500,
                  height: 400,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 120, opacity: 0.8 }} />
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 12 }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{ 
              fontWeight: 700,
              mb: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Why Choose CalendarSync?
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Powerful features designed to make your calendar management effortless and efficient
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 4,
          justifyContent: 'center'
        }}>
          <FeatureCard
            icon={<SyncIcon />}
            title="Real-time Sync"
            description="Changes sync automatically across all your connected calendars. Update once, sync everywhere."
          />
          <FeatureCard
            icon={<SecurityIcon />}
            title="Secure & Private"
            description="Your data is encrypted and secure. We never share your calendar information with third parties."
          />
          <FeatureCard
            icon={<SpeedIcon />}
            title="Lightning Fast"
            description="Optimized for speed and performance. Access your calendars instantly from anywhere."
          />
        </Box>
      </Container>

      {/* How It Works Section */}
      <Box sx={{ bgcolor: 'grey.50', py: 12 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            align="center"
            gutterBottom
            sx={{ 
              fontWeight: 700,
              mb: 6,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            How It Works
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 6 }}>
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  width: '100%',
                  height: 300,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="20" cy="20" r="1"/%3E%3C/g%3E%3C/svg%3E")',
                  }
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 80, opacity: 0.8 }} />
              </Box>
            </Box>
            
            <Box sx={{ flex: 1, pl: { md: 4 } }}>
              <Typography variant="h4" component="h3" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
                Simple 3-Step Setup
              </Typography>
              
              <Box sx={{ space: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      mr: 3,
                      flexShrink: 0
                    }}
                  >
                    1
                  </Box>
                  <Box>
                    <Typography variant="h6" component="h4" gutterBottom sx={{ fontWeight: 600 }}>
                      Connect Your Calendars
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Securely connect your Google and Microsoft calendars with just a few clicks.
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      mr: 3,
                      flexShrink: 0
                    }}
                  >
                    2
                  </Box>
                  <Box>
                    <Typography variant="h6" component="h4" gutterBottom sx={{ fontWeight: 600 }}>
                      View Unified Calendar
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      See all your events in one beautiful, organized calendar interface.
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      mr: 3,
                      flexShrink: 0
                    }}
                  >
                    3
                  </Box>
                  <Box>
                    <Typography variant="h6" component="h4" gutterBottom sx={{ fontWeight: 600 }}>
                      Create & Manage Events
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Create new events and manage existing ones with powerful tools and features.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 12,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.3,
        }
      }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Typography 
              variant="h3" 
              component="h2" 
              gutterBottom 
              sx={{ 
                color: 'white',
                fontWeight: 700,
                mb: 3
              }}
            >
              Ready to streamline your calendar management?
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                mb: 6,
                lineHeight: 1.6
              }}
            >
              Join thousands of users who have simplified their scheduling and never miss an important event again.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="large"
                sx={{
                  bgcolor: '#fbbf24',
                  color: '#1f2937',
                  px: 6,
                  py: 2,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  textTransform: 'none',
                  boxShadow: '0 10px 25px rgba(251, 191, 36, 0.3)',
                  '&:hover': {
                    bgcolor: '#f59e0b',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 15px 35px rgba(251, 191, 36, 0.4)',
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                Start Free Trial
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="large"
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  px: 6,
                  py: 2,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'white',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                Sign In
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;