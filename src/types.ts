export type DefaultConfig = Omit<AuthConfig, "authURL" | "apiURL">;

export interface AuthConfig {
  authURL: string; // The URL to authenticate users.
  storageKey: string; // Key to store the authentication token in local storage.
  disableAutoLogin: boolean; // Flag to disable auto-login.
  database?: string; // The database to authenticate users.
  application?: string; // Sent to the auth server to identify the application.
  apiURL?: string; // The base URL for the API.
}

export interface TokenInfo {
  timeUntilExpiry: {
    inSeconds: number;
    inMinutes: number;
  };
  user: {
    id: string | null;
    username: string | null;
    database: string | null;
    application: string | null;
  };
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string | null;
}
