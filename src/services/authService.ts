/**
 * Authentication service for ZoneMinder API
 */
import api, { tokenStorage, setApiBaseUrl } from './api';
import { LoginCredentials, AuthTokens, User } from '../types';

class AuthService {
  /**
   * Login to ZoneMinder server
   */
  async login(credentials: LoginCredentials, baseUrl: string): Promise<AuthTokens> {
    // Set the base URL for this request
    setApiBaseUrl(baseUrl);
    
    // Save base URL for future requests
    await tokenStorage.setBaseUrl(baseUrl);

    try {
      const response = await api.post<AuthTokens>('/api/host/login', {
        user: credentials.username,
        pass: credentials.password,
      });

      const tokens = response.data;
      
      // Save tokens to secure storage
      await tokenStorage.setTokens(tokens);
      
      return tokens;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout - clear stored tokens
   */
  async logout(): Promise<void> {
    try {
      // Try to call logout endpoint
      await api.post('/api/host/logout');
    } catch (error) {
      // Ignore logout errors - we'll clear tokens anyway
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local tokens
      await tokenStorage.removeTokens();
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await tokenStorage.getTokens();
    return !!tokens?.access_token;
  }

  /**
   * Get stored tokens
   */
  async getTokens(): Promise<AuthTokens | null> {
    return tokenStorage.getTokens();
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await api.get<User>('/api/host/login.json');
      return response.data;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<AuthTokens | null> {
    const tokens = await tokenStorage.getTokens();
    
    if (!tokens?.refresh_token) {
      return null;
    }

    try {
      const response = await api.post<AuthTokens>('/api/host/login', {
        refresh_token: tokens.refresh_token,
      });

      const newTokens = response.data;
      await tokenStorage.setTokens(newTokens);
      
      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await tokenStorage.removeTokens();
      throw error;
    }
  }

  /**
   * Initialize API client with stored configuration
   */
  async initialize(): Promise<boolean> {
    const baseUrl = await tokenStorage.getBaseUrl();
    const tokens = await tokenStorage.getTokens();

    if (baseUrl) {
      setApiBaseUrl(baseUrl);
    }

    return !!tokens?.access_token;
  }
}

export const authService = new AuthService();
export default authService;