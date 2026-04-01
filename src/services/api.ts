/**
 * Axios API client with interceptors for ZoneMinder
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Preferences } from '@capacitor/preferences';
import { AuthTokens } from '../types';

const TOKEN_KEY = 'zm_auth_tokens';
const BASE_URL_KEY = 'zm_base_url';
const CREDENTIALS_KEY = 'zm_credentials'; // Store credentials for re-auth

// Create axios instance
// ZoneMinder 1.38+ uses JWT token-based authentication
// The access_token must be sent as Bearer token in Authorization header
const api = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In development, use relative URLs (Vite proxy handles CORS)
// In production, use the full base URL
if (import.meta.env.DEV) {
  api.defaults.baseURL = '';
}

// Helper to add timeout to Promise
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback?: () => T): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fallback) {
        resolve(fallback());
      } else {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        if (fallback) {
          resolve(fallback());
        } else {
          reject(error);
        }
      });
  });
};

// LocalStorage fallback for web development
const localStorageFallback = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      throw e;
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch { }
  }
};

// Token storage utilities
export const tokenStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    try {
      // Use localStorage directly in development (web browser)
      // Capacitor Preferences can hang in web browsers
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
        const value = localStorageFallback.get(TOKEN_KEY);
        if (value) {
          return JSON.parse(value);
        }
        return null;
      }
      
      // Use Capacitor Preferences with timeout for production/mobile
      const result = await withTimeout(
        Preferences.get({ key: TOKEN_KEY }),
        3000, // 3 second timeout
        () => ({ value: localStorageFallback.get(TOKEN_KEY) })
      );
      
      const { value } = result;
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch {
      return null;
    }
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      const value = JSON.stringify(tokens);
      
      // Use localStorage directly in development (web browser)
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
        localStorageFallback.set(TOKEN_KEY, value);
        return;
      }
      
      // Use Capacitor Preferences with timeout for production/mobile
      await withTimeout(
        Preferences.set({ key: TOKEN_KEY, value }),
        3000,
        () => {
          localStorageFallback.set(TOKEN_KEY, value);
        }
      );
    } catch (error) {
      throw error;
    }
  },

  async removeTokens(): Promise<void> {
    try {
      // Use localStorage directly in development (web browser)
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
        localStorageFallback.remove(TOKEN_KEY);
        return;
      }
      
      // Use Capacitor Preferences with timeout for production/mobile
      await withTimeout(
        Preferences.remove({ key: TOKEN_KEY }),
        3000,
        () => {
          localStorageFallback.remove(TOKEN_KEY);
        }
      );
    } catch (error) {
      throw error;
    }
  },

  async getBaseUrl(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: BASE_URL_KEY });
      return value;
    } catch (error) {
      console.error('Error getting base URL from storage:', error);
      return null;
    }
  },

  async setBaseUrl(url: string): Promise<void> {
    try {
      await Preferences.set({
        key: BASE_URL_KEY,
        value: url,
      });
    } catch (error) {
      console.error('Error saving base URL to storage:', error);
      throw error;
    }
  },

  async removeBaseUrl(): Promise<void> {
    try {
      await Preferences.remove({ key: BASE_URL_KEY });
    } catch (error) {
      console.error('Error removing base URL from storage:', error);
      throw error;
    }
  },

  // Store credentials for automatic re-authentication (needed for cookie-based auth)
  async saveCredentials(username: string, password: string): Promise<void> {
    try {
      await Preferences.set({
        key: CREDENTIALS_KEY,
        value: JSON.stringify({ username, password }),
      });
    } catch (error) {
      console.error('Error saving credentials to storage:', error);
      throw error;
    }
  },

  async getCredentials(): Promise<{ username: string; password: string } | null> {
    try {
      const { value } = await Preferences.get({ key: CREDENTIALS_KEY });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting credentials from storage:', error);
      return null;
    }
  },

  async removeCredentials(): Promise<void> {
    try {
      await Preferences.remove({ key: CREDENTIALS_KEY });
    } catch (error) {
      console.error('Error removing credentials from storage:', error);
      throw error;
    }
  },
};

// Track if we're currently re-authenticating to prevent loops
let isReauthenticating = false;
let reauthPromise: Promise<boolean> | null = null;
const MAX_REAUTH_ATTEMPTS = 1;
let reauthenticationAttempts = 0;

// Request interceptor - add token as query parameter for JWT authentication
// ZoneMinder 1.38+ uses JWT token-based authentication
// IMPORTANT: ZoneMinder expects the token as a query parameter (?token=<access_token>), NOT as a Bearer header
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip adding token for login endpoint - this is the endpoint that gives us the token
    const url = config.url || '';
    if (url.includes('/api/host/login')) {
      return config;
    }
    
    // Get the access token from storage
    const tokens = await tokenStorage.getTokens();
    
    if (tokens?.access_token) {
      // Add token as query parameter (ZoneMinder API v2.0 requirement)
      config.params = config.params || {};
      config.params.token = tokens.access_token;
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors
// ZoneMinder 1.38+ uses JWT token-based authentication
// When we get a 401, the access token has expired - we need to re-authenticate
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    console.error('[API] Response error:', error.config?.method?.toUpperCase(), error.config?.url, '- Status:', error.response?.status);
    
    if (error.response?.status === 401) {
      // Prevent retrying a request that has already been retried
      // This prevents infinite loops when re-auth succeeds but the retry still fails
      if ((error.config as any)?._retried) {
        await tokenStorage.removeTokens();
        await tokenStorage.removeCredentials();
        reauthenticationAttempts = 0;
        return Promise.reject(error);
      }

      // If already re-authenticating, wait for it to complete
      if (isReauthenticating && reauthPromise) {
        const success = await reauthPromise;
        if (success && error.config) {
          // Mark this request as retried to prevent infinite loops
          (error.config as any)._retried = true;
          // Retry the original request - the new Bearer token will be added by request interceptor
          return api.request(error.config);
        }
        return Promise.reject(error);
      }

      // Check if we've exceeded max attempts
      if (reauthenticationAttempts >= MAX_REAUTH_ATTEMPTS) {
        await tokenStorage.removeTokens();
        await tokenStorage.removeCredentials();
        reauthenticationAttempts = 0;
        return Promise.reject(error);
      }
      
      // Session expired - try to re-authenticate with stored credentials
      const credentials = await tokenStorage.getCredentials();
      
      if (credentials) {
        isReauthenticating = true;
        reauthenticationAttempts++;
        
        reauthPromise = (async () => {
          try {
            // Re-authenticate using stored credentials
            const params = new URLSearchParams();
            params.append('user', credentials.username);
            params.append('pass', credentials.password);
            
            // Re-authenticate to get a new access token
            const response = await api.post('/zm/api/host/login.json', params, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
            
            // Store the new tokens (contains access_token and refresh_token)
            await tokenStorage.setTokens(response.data);
            
            // Reset attempts on success
            reauthenticationAttempts = 0;
            return true;
          } catch (refreshError) {
            console.error('[API] Re-authentication failed:', refreshError);
            // Clear tokens and credentials on failure
            await tokenStorage.removeTokens();
            await tokenStorage.removeCredentials();
            return false;
          } finally {
            isReauthenticating = false;
            reauthPromise = null;
          }
        })();
        
        const success = await reauthPromise;
        
        if (success && error.config) {
          // Mark this request as retried to prevent infinite loops
          (error.config as any)._retried = true;
          // Retry the original request - the fresh token will be added as query parameter by request interceptor
          return api.request(error.config);
        }
      } else {
        await tokenStorage.removeTokens();
      }
    }
    return Promise.reject(error);
  }
);

export const setApiBaseUrl = (baseUrl: string) => {
  api.defaults.baseURL = baseUrl;
};

export default api;