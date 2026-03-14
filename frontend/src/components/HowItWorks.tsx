import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      label: 'Create Your Free Account',
      description: 'Sign up in less than 30 seconds with just your email address. No credit card required, no hidden fees.',
      icon: <CheckCircleIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      label: 'Connect Your Google Calendar',
      description: 'Click "Connect Google Calendar" and authorize access through Google\'s secure OAuth. We only request access to your calendar data - nothing else. No emails, no files, no contacts.',
      icon: <GoogleIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
    },
    {
      label: 'Connect Your Microsoft Outlook Calendar',
      description: 'Click "Connect Microsoft Outlook" and authorize through Microsoft\'s secure OAuth. Again, we only access your calendar events - your emails and documents remain completely private.',
      icon: <MicrosoftIcon sx={{ fontSize: 40, color: '#00A4EF' }} />,
    },
    {
      label: 'View All Events in One Dashboard',
      description: 'Instantly see all your Google and Microsoft calendar events in a beautiful, unified interface. Color-coded by source, fully searchable, and organized exactly how you need it.',
      icon: <CalendarMonthIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      label: 'Enjoy Real-Time Synchronization',
      description: 'Create, edit, or delete events in either Google or Microsoft calendars - changes appear instantly in your unified view thanks to webhook technology. No manual refreshing needed.',
      icon: <SyncIcon sx={{ fontSize: 40, color: 'success.main' }} />,
    },
  ];

  const features = [
    {
      title: 'Two-Way Sync',
      description: 'Changes made in Google Calendar or Microsoft Outlook automatically appear in your unified view within seconds.',
    },
    {
      title: 'Multiple Calendar Views',
      description: 'Switch between day, week, and month views to see your schedule exactly how you prefer.',
    },
    {
      title: 'Event Details',
      description: 'View full event details including location, attendees, descriptions, and video conference links.',
    },
    {
      title: 'Mobile Responsive',
      description: 'Access your unified calendar from any device - desktop, tablet, or smartphone.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>How It Works - Sync Google & Microsoft Calendars | Unified Calendar View</title>
        <meta 
          name="description" 
          content="Learn how to sync Google Calendar and Microsoft Outlook in 5 simple steps. Connect your calendars securely, view all events in one place, and enjoy real-time synchronization across all platforms." 
        />
        <meta 
          name="keywords" 
          content="how to sync google calendar, how to sync outlook calendar, calendar sync tutorial, unified calendar setup, google microsoft calendar integration" 
        />
        <link rel="canonical" href="https://unifiedcalendarview.com/how-it-works" />
        
        {/* Open Graph */}
        <meta property="og:title" content="How It Works - Sync Google & Microsoft Calendars" />
        <meta property="og:description" content="Learn how to sync Google Calendar and Microsoft Outlook in 5 simple steps with Unified Calendar View." />
        <meta property="og:url" content="https://unifiedcalendarview.com/how-it-works" />
        
        {/* Twitter */}
        <meta name="twitter:title" content="How It Works - Sync Google & Microsoft Calendars" />
        <meta name="twitter:description" content="Learn how to sync Google Calendar and Microsoft Outlook in 5 simple steps with Unified Calendar View." />
        
        {/* FAQ Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Sync Google Calendar and Microsoft Outlook Together",
            "description": "Step-by-step guide to viewing Google and Microsoft calendar events in one unified dashboard",
            "step": [
              {
                "@type": "HowToStep",
                "name": "Create Your Free Account",
                "text": "Sign up for Unified Calendar View with just your email address. No credit card required.",
                "url": "https://unifiedcalendarview.com/register"
              },
              {
                "@type": "HowToStep",
                "name": "Connect Google Calendar",
                "text": "Authorize Unified Calendar View to access your Google Calendar events through secure OAuth authentication."
              },
              {
                "@type": "HowToStep",
                "name": "Connect Microsoft Outlook",
                "text": "Authorize Unified Calendar View to access your Microsoft Outlook calendar events through secure OAuth authentication."
              },
              {
                "@type": "HowToStep",
                "name": "View Unified Calendar",
                "text": "See all your Google and Microsoft calendar events in one beautiful dashboard with real-time synchronization."
              }
            ]
          })}
        </script>
      </Helmet>

      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        {/* Hero Section */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            py: { xs: 8, md: 10 },
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
            <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <Typography 
                variant="h1" 
                component="h1" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2,
                  mb: 3
                }}
              >
                How to Sync Google Calendar and Microsoft Outlook
              </Typography>
              <Typography 
                variant="h2" 
                component="h2"
                sx={{ 
                  mb: 4, 
                  opacity: 0.9,
                  lineHeight: 1.6,
                  fontWeight: 300,
                  fontSize: { xs: '1.25rem', md: '1.5rem' },
                  maxWidth: 800,
                  mx: 'auto'
                }}
              >
                Follow these 5 simple steps to view all your calendar events in one unified dashboard. Setup takes less than 2 minutes.
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* Step-by-Step Guide */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Typography
            variant="h2"
            component="h2"
            align="center"
            gutterBottom
            sx={{
              fontWeight: 700,
              mb: 6,
              fontSize: { xs: '2rem', md: '2.5rem' }
            }}
          >
            5 Steps to Unified Calendar Bliss
          </Typography>

          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Stepper orientation="vertical">
              {steps.map((step, index) => (
                <Step key={index} active={true} completed={false}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          bgcolor: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          border: '3px solid',
                          borderColor: 'primary.main'
                        }}
                      >
                        {step.icon}
                      </Box>
                    )}
                  >
                    <Typography variant="h3" component="h3" sx={{ fontWeight: 600, fontSize: '1.5rem', mt: 1 }}>
                      Step {index + 1}: {step.label}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: 'text.secondary', fontSize: '1.1rem' }}>
                      {step.description}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: 'primary.main',
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                fontWeight: 600,
                borderRadius: 3,
                textTransform: 'none',
                boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 15px 35px rgba(102, 126, 234, 0.4)',
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              Get Started Now - It's Free
            </Button>
          </Box>
        </Container>

        {/* What You Get Section */}
        <Box sx={{ bgcolor: 'grey.50', py: { xs: 6, md: 10 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h2"
              component="h2"
              align="center"
              gutterBottom
              sx={{
                fontWeight: 700,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.5rem' }
              }}
            >
              What You Get with Unified Calendar View
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ mb: 6, color: 'text.secondary', fontSize: '1.1rem', maxWidth: 700, mx: 'auto' }}
            >
              Once you've connected your calendars, you'll have access to powerful features that make calendar management effortless.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 3
              }}
            >
              {features.map((feature, index) => (
                <Card
                  key={index}
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <CheckCircleIcon sx={{ fontSize: 36, color: 'success.main', mb: 2 }} />
                    <Typography variant="h4" component="h4" gutterBottom sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Container>
        </Box>

        {/* Security & Privacy Section */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Typography
            variant="h2"
            component="h2"
            align="center"
            gutterBottom
            sx={{
              fontWeight: 700,
              mb: 6,
              fontSize: { xs: '2rem', md: '2.5rem' }
            }}
          >
            Your Privacy is Our Priority
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Card
                sx={{
                  p: 4,
                  borderRadius: 3,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                <SecurityIcon sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h3" component="h3" gutterBottom sx={{ fontWeight: 600, fontSize: '1.75rem' }}>
                  Secure OAuth Authentication
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
                  We use industry-standard OAuth 2.0 authentication, the same secure protocol used by banks and healthcare providers.
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                  We ONLY request access to your calendar events - nothing else. Your emails, files, contacts, and documents remain completely private and inaccessible to our application.
                </Typography>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h3" component="h3" gutterBottom sx={{ fontWeight: 600, fontSize: '1.75rem', mb: 3 }}>
                What We Access vs. What We Don't
              </Typography>
              
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
                <Typography variant="h4" component="h4" gutterBottom sx={{ fontWeight: 600, color: 'success.dark', fontSize: '1.25rem' }}>
                  ✓ What We Access:
                </Typography>
                <Box component="ul" sx={{ pl: 3, m: 0 }}>
                  <li><Typography>Calendar event titles</Typography></li>
                  <li><Typography>Event dates and times</Typography></li>
                  <li><Typography>Event locations</Typography></li>
                  <li><Typography>Event descriptions</Typography></li>
                  <li><Typography>Event attendees (calendar-specific)</Typography></li>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, bgcolor: 'grey.100', border: '2px solid', borderColor: 'grey.400' }}>
                <Typography variant="h4" component="h4" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', fontSize: '1.25rem' }}>
                  ✗ What We DON'T Access:
                </Typography>
                <Box component="ul" sx={{ pl: 3, m: 0 }}>
                  <li><Typography>Your emails or email content</Typography></li>
                  <li><Typography>Your Google Drive or OneDrive files</Typography></li>
                  <li><Typography>Your contacts or contact lists</Typography></li>
                  <li><Typography>Your documents or spreadsheets</Typography></li>
                  <li><Typography>Any other account data</Typography></li>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Container>

        {/* FAQ Section */}
        <Box sx={{ bgcolor: 'grey.50', py: { xs: 6, md: 10 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h2"
              component="h2"
              align="center"
              gutterBottom
              sx={{
                fontWeight: 700,
                mb: 6,
                fontSize: { xs: '2rem', md: '2.5rem' }
              }}
            >
              Frequently Asked Questions
            </Typography>

            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              {[
                {
                  q: 'How long does setup take?',
                  a: 'Most users complete the entire setup in under 2 minutes. Just sign up, click two buttons to connect your calendars, and you\'re done!'
                },
                {
                  q: 'Do I need to install any software?',
                  a: 'No! Unified Calendar View is completely web-based. Access it from any browser on any device - desktop, tablet, or smartphone.'
                },
                {
                  q: 'Will changes sync in real-time?',
                  a: 'Yes! We use webhook technology to receive instant notifications when your calendars change. Updates appear in your unified view within seconds.'
                },
                {
                  q: 'Can I disconnect my calendars anytime?',
                  a: 'Absolutely. You can disconnect either or both calendars at any time from your settings page. Your calendar data remains unchanged in Google and Microsoft.'
                },
                {
                  q: 'Is my data encrypted?',
                  a: 'Yes. All data transmitted between your browser and our servers is encrypted using industry-standard TLS/SSL protocols. We also encrypt data at rest.'
                },
                {
                  q: 'What if I only use one calendar service?',
                  a: 'That\'s fine! You can connect just Google Calendar or just Microsoft Outlook. You\'re not required to connect both.'
                }
              ].map((faq, index) => (
                <Card key={index} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h4" component="h4" gutterBottom sx={{ fontWeight: 600, fontSize: '1.25rem', color: 'primary.main' }}>
                      {faq.q}
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.secondary' }}>
                      {faq.a}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Container>
        </Box>

        {/* CTA Section */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            py: { xs: 8, md: 10 },
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
          <Container maxWidth="md">
            <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <Typography
                variant="h2"
                component="h2"
                gutterBottom
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 3,
                  fontSize: { xs: '2rem', md: '2.5rem' }
                }}
              >
                Ready to Stop Switching Between Calendar Apps?
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  mb: 4,
                  lineHeight: 1.8,
                  fontSize: '1.1rem'
                }}
              >
                Join thousands of professionals who've unified their calendar experience. Setup takes less than 2 minutes.
              </Typography>
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
                Connect Your Calendars Now
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Footer */}
        <Box sx={{ bgcolor: 'background.paper', py: 3, textAlign: 'center', borderTop: '1px solid #eee' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            For any questions feel free to reach out to admin@unifiedcalendarview.com
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <RouterLink to="/policy" style={{ color: '#667eea', textDecoration: 'underline' }}>
              Privacy Policy
            </RouterLink>
            {' | '}
            <RouterLink to="/" style={{ color: '#667eea', textDecoration: 'underline' }}>
              Home
            </RouterLink>
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default HowItWorks;