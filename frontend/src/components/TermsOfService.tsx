import React from 'react';
import { Container, Box, Typography, Link } from '@mui/material';

const TermsOfService: React.FC = () => (
  <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 6 }}>
    <Container maxWidth="md">
      <Typography variant="h2" component="h1" gutterBottom fontWeight={700}>
        Terms of Service
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Effective Date: September 7, 2025
      </Typography>
      <Typography paragraph>
        Welcome to Unified Calendar View (“we”, “our”, “us”). By using our services, you agree to the following Terms of Service (“Terms”). Please read them carefully.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom mt={3}>
        1. Use of Our Service
      </Typography>
      <Typography paragraph>
        Unified Calendar View allows you to connect your Google and Microsoft accounts to view, create, and manage calendar events in one unified dashboard.
        <br />
        You must be at least 13 years old to use this service.
        <br />
        You are responsible for maintaining the confidentiality of your account credentials.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        2. User Data and Privacy
      </Typography>
      <Typography paragraph>
        We only request access to your Google and Microsoft Calendar data to provide the service (viewing, syncing, creating, and updating events).
        <br />
        We do not sell, rent, or misuse your data.
        <br />
        Our use of your data is governed by our Privacy Policy.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        3. Acceptable Use
      </Typography>
      <Typography paragraph>
        You agree not to:
        <ul>
          <li>Use the service for unlawful purposes.</li>
          <li>Attempt to gain unauthorized access to the service.</li>
          <li>Interfere with or disrupt the service or its servers.</li>
        </ul>
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        4. Third-Party Services
      </Typography>
      <Typography paragraph>
        Our service integrates with Google Calendar API and Microsoft Graph API.
        <br />
        Your use of these integrations is also subject to their respective terms and policies:
        <ul>
          <li>
            <Link href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">
              Google APIs Terms of Service
            </Link>
          </li>
          <li>
            <Link href="https://www.microsoft.com/en-us/servicesagreement/" target="_blank" rel="noopener">
              Microsoft Services Agreement
            </Link>
          </li>
        </ul>
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        5. Service Availability
      </Typography>
      <Typography paragraph>
        We aim to provide a reliable service, but we do not guarantee uninterrupted availability.
        <br />
        We may modify, suspend, or discontinue parts of the service at any time without notice.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        6. Disclaimer of Warranties
      </Typography>
      <Typography paragraph>
        The service is provided “as is” without warranties of any kind.
        <br />
        We do not guarantee that the service will be error-free or that data will always be synchronized without delays.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        7. Limitation of Liability
      </Typography>
      <Typography paragraph>
        To the maximum extent permitted by law, Unified Calendar View shall not be liable for any damages resulting from your use of the service.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        8. Changes to These Terms
      </Typography>
      <Typography paragraph>
        We may update these Terms from time to time.
        <br />
        Continued use of the service after changes means you accept the updated Terms.
      </Typography>
      <Typography variant="h5" component="h3" gutterBottom>
        9. Contact Us
      </Typography>
      <Typography paragraph>
        If you have questions about these Terms, contact us at:
        <ul>
          <li>📧 admin@unifiedcalendarview.com</li>
        </ul>
      </Typography>
    </Container>
  </Box>
);

export default TermsOfService;
