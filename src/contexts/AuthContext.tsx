/**
 * Authentication context for React app
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, LoginCredentials } from '../types';
import { authService } from '../services';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials, baseUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  isLoading: true,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  const checkAuth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const isAuth = await authService.initialize();
      
      if (isAuth) {
        const tokens = await authService.getTokens();
        setState({
          isAuthenticated: true,
          user: null, // Will be loaded on demand
          tokens,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          error: null,
        });
      }
    } catch {
      setState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: 'Failed to check authentication status',
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (credentials: LoginCredentials, baseUrl: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const tokens = await authService.login(credentials, baseUrl);
      
      setState({
        isAuthenticated: true,
        user: null,
        tokens,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || 
        err.message || 
        'Login failed. Please check your credentials.';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await authService.logout();
      
      setState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: null,
      });
    } catch {
      // Still clear state even if logout fails
      setState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;