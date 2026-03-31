/**
 * Axios API client with interceptors for ZoneMinder
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Preferences } from '@capacitor/preferences';
import { AuthTokens } from '../types';

const TOKEN_KEY = 'zm_auth_tokens';
const BASE_URL_KEY = 'zm_base_url';

// Create axios instance
const api = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage utilities
export const tokenStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    try {
      const { value } = await Preferences.get({ key: TOKEN_KEY });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting tokens from storage:', error);
      return null;
    }
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await Preferences.set({
        key: TOKEN_KEY,
        value: JSON.stringify(tokens),
      });
    } catch (error) {
      console.error('Error saving tokens to storage:', error);
      throw error;
    }
  },

  async removeTokens(): Promise<void> {
    try {
      await Preferences.remove({ key: TOKEN_KEY });
    } catch (error) {
      console.error('Error removing tokens from storage:', error);
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
};

// Request interceptor - add auth token to requests
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const tokens = await tokenStorage.getTokens();
    if (tokens?.access_token) {
      config.headers.Authorization = `Bearer ${tokens.access_token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear tokens
      await tokenStorage.removeTokens();
    }
    return Promise.reject(error);
  }
);

export const setApiBaseUrl = (baseUrl: string) => {
  api.defaults.baseURL = baseUrl;
};

export default api;