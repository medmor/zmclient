/**
 * Authentication types for ZoneMinder API
 * ZoneMinder uses cookie-based session authentication, not token-based
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * ZoneMinder login response
 * ZoneMinder uses session cookies, not access tokens
 * The response contains user information, not tokens
 */
export interface AuthTokens {
  // ZoneMinder doesn't use token-based auth, but we keep this interface
  // for compatibility. The 'access_token' can be a session ID or just a flag
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * User information returned from ZoneMinder API
 */
export interface User {
  id: number;
  username: string;
  email?: string;
  name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

export interface ZmApiConfig {
  baseUrl: string;
  username: string;
  password: string;
}