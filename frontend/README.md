# Calendar Sync App Frontend

This is the frontend application for the Calendar Sync App, built with React, TypeScript, and Tailwind CSS.

## Features

- User authentication with JWT
- Google Calendar integration
- Microsoft Calendar integration
- Real-time calendar synchronization
- Modern, responsive UI with Tailwind CSS

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   VITE_API_URL=http://localhost:3000
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues

## Project Structure

```
frontend/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── theme/         # Theme configuration
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Application entry point
├── public/            # Static assets
├── index.html         # HTML template
└── package.json       # Project dependencies and scripts
```

## Development

The frontend application uses:
- React for the UI framework
- TypeScript for type safety
- Tailwind CSS for styling
- React Router for navigation
- Axios for API requests

## API Integration

The frontend communicates with the backend API through the following endpoints:

- `/api/auth/*` - Authentication endpoints
- `/api/calendar-accounts` - Calendar account management
- `/api/events` - Calendar events management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 