// Loaded before any test file via `setupFiles`. Must run before application
// modules are imported, since several of them read process.env at import time
// (e.g. dotenv.config() calls) or at call time (e.g. JWT signing).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "604800";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret";
process.env.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "test-microsoft-client-id";
process.env.MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "test-microsoft-client-secret";
