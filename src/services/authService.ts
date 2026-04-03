/**
 * Authentication service for ZoneMinder API
 * ZoneMinder uses cookie-based session authentication, not token-based
 * For mobile apps (Capacitor), we store credentials and re-authenticate when needed
 */
import api, { tokenStorage, setApiBaseUrl } from './api';
import { LoginCredentials, AuthTokens, User } from '../types';

class AuthService {
  /**
   * Login to ZoneMinder server
   * ZoneMinder uses cookie-based session authentication
   */
  async login(credentials: LoginCredentials, baseUrl: string): Promise<AuthTokens> {
    // Always store the base URL - it's needed for stream URLs (img src, blob fetches)
    // even in development mode where the Vite proxy handles API requests
    await tokenStorage.setBaseUrl(baseUrl);
    
    // In development, the Vite proxy handles CORS - don't set axios base URL
    // In production, set the base URL for API requests
    if (!import.meta.env.DEV) {
      setApiBaseUrl(baseUrl);
    }

    try {
      // ZoneMinder expects form-encoded data, not JSON
      const params = new URLSearchParams();
      params.append('user', credentials.username);
      params.append('pass', credentials.password);

      const response = await api.post<AuthTokens>('/zm/api/host/login.json', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = response.data;
      
      // Save authentication state to storage
      // ZoneMinder uses session cookies, but we store a flag for app state
      await tokenStorage.setTokens(tokens);
      
      // Save credentials for automatic re-authentication (needed for cookie-based auth)
      await tokenStorage.saveCredentials(credentials.username, credentials.password);
      
      return tokens;
    } catch (error) {
      console.error('[AuthService] Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout - clear stored tokens and session
   */
  async logout(): Promise<void> {
    try {
      // Try to call logout endpoint to clear server session
      await api.post('/zm/api/host/logout.json');
    } catch (error) {
      // Ignore logout errors - we'll clear local state anyway
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local authentication state
      await tokenStorage.removeTokens();
      await tokenStorage.removeCredentials();
    }
  }

  /**
   * Check if user is authenticated
   * For cookie-based auth, we check if we have stored credentials
   * and verify the session is still valid
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await tokenStorage.getTokens();
    if (!tokens?.access_token) {
      return false;
    }

    // Verify session is still valid by making a test API call
    // But don't try to re-authenticate here to avoid loops
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      // Session is expired or invalid
      // Don't try to re-authenticate here - let the API interceptor handle it
      return false;
    }
  }

  /**
   * Try to re-authenticate using stored credentials
   */
  private async tryReauthenticate(): Promise<boolean> {
    try {
      const credentials = await tokenStorage.getCredentials();
      const baseUrl = await tokenStorage.getBaseUrl();
      
      if (!credentials || !baseUrl) {
        return false;
      }

      // Try to login again with stored credentials
      await this.login(credentials, baseUrl);
      return true;
    } catch (error) {
      console.error('Re-authentication failed:', error);
      await tokenStorage.removeTokens();
      await tokenStorage.removeCredentials();
      return false;
    }
  }

  /**
   * Get stored tokens (authentication state)
   */
  async getTokens(): Promise<AuthTokens | null> {
    return tokenStorage.getTokens();
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await api.get<User>('/zm/api/host/login.json');
      return response.data;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Refresh authentication - for cookie-based auth, this re-validates the session
   */
  async refreshToken(): Promise<AuthTokens | null> {
    // ZoneMinder doesn't use refresh tokens
    // If session is expired, try to re-authenticate with stored credentials
    const success = await this.tryReauthenticate();
    if (success) {
      return this.getTokens();
    }
    return null;
  }

  /**
   * Initialize API client with stored configuration
   */
  async initialize(): Promise<boolean> {
    // In development, the Vite proxy handles CORS - don't set base URL
    if (!import.meta.env.DEV) {
      const baseUrl = await tokenStorage.getBaseUrl();
      if (baseUrl) {
        setApiBaseUrl(baseUrl);
      }
    }

    // Check if we have stored authentication state
    const tokens = await tokenStorage.getTokens();
    
    if (!tokens) {
      return false;
    }
    
    if (!tokens.access_token) {
      return false;
    }
    
    // Just check if we have tokens - don't validate session during initialization
    // The API interceptor will handle re-authentication if needed
    return true;
  }
}

export const authService = new AuthService();
export default authService;