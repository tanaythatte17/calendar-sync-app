import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Add timezone to user context
export interface User {
  _id: string;
  email: string;
  name?: string;
  timezone?: string;
  // ...other fields
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateUserTimezone: (timezone: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Ensure cookies are sent and received
});

export { api };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Define fetchUserProfile before login/register
  const fetchUserProfile = async () => {
    try {
      const res = await api.get(`${API_URL}/user/profile`);
      setUser(res.data);
    } catch (err) {
      // handle error
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      const { _id, name, email: userEmail, token } = response.data;
      localStorage.setItem('token', token); // store for OAuth state
      setUser({ _id, name, email: userEmail });
      await fetchUserProfile(); // Fetch user profile after successful login
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string, confirmPassword: string) => {
    try {
      const response = await api.post('/auth/signup', {
        name,
        email,
        password,
        confirmPassword
      });
      const { _id, name: userName, email: userEmail, token } = response.data;
      localStorage.setItem('token', token); // store for OAuth state
      setUser({ _id, name: userName, email: userEmail });
      await fetchUserProfile(); // Fetch user profile after successful registration
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('token'); // clear from localStorage
      setUser(null);
    }
  };

  // Add updateUserTimezone function
  const updateUserTimezone = async (timezone: string) => {
    try {
      const res = await api.put(`${API_URL}/user/timezone`, { timezone });
      setUser(res.data);
      return true;
    } catch (err) {
      return false;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    updateUserTimezone: updateUserTimezone,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 