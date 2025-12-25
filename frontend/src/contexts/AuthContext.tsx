import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface User {
  _id: string;
  email: string;
  name?: string;
  timezone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateUserTimezone: (timezone: string) => Promise<boolean>;
  // OAuth methods
  loginWithGoogle: () => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
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
      await fetchUserProfile();
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await api.get(`${API_URL}/user/profile`);
      setUser(res.data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      const { _id, name, email: userEmail } = response.data;
      setUser({ _id, name, email: userEmail });
      await fetchUserProfile();
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
      const { _id, name: userName, email: userEmail } = response.data;
      setUser({ _id, name: userName, email: userEmail });
      await fetchUserProfile();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      try {
        document.cookie = 'jwt=; Max-Age=0; path=/; SameSite=None; Secure';
      } catch {}
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const updateUserTimezone = async (timezone: string) => {
    try {
      const res = await api.put(`${API_URL}/user/timezone`, { timezone });
      setUser(res.data);
      return true;
    } catch (err) {
      return false;
    }
  };

  // OAuth Methods
  const loginWithGoogle = async () => {
    try {
      const response = await api.get('/auth/google/auth');
      if (response.data.url) {
        // Redirect to Google OAuth
        window.location.href = response.data.url;
      } else {
        throw new Error('Failed to get Google authorization URL');
      }
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  };

  const loginWithMicrosoft = async () => {
    try {
      const response = await api.get('/auth/microsoft/auth');
      if (response.data.url) {
        // Redirect to Microsoft OAuth
        window.location.href = response.data.url;
      } else {
        throw new Error('Failed to get Microsoft authorization URL');
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    updateUserTimezone,
    loginWithGoogle,
    loginWithMicrosoft,
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