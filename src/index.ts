import { AuthClientClass } from "./client";
import { AUTH_CLIENT_NOT_INITIALIZED } from "./conts";
import { AuthConfig, DefaultConfig } from "./types";
import { mergeConfig } from "./utils";

const defaultConfig: DefaultConfig = {
  storageKey: "authToken",
  application: "default",
  disableAutoLogin: false,
};

let client: AuthClient | null = null;

/**
 *
 * @param config Partial configuration for the AuthClient.
 * Merges the provided config with the default configuration and initializes the AuthClient.
 * If the `disableAutoLogin` flag is set to true, the client will not attempt to log in automatically.
 */
export function createAuthClient(config: Partial<AuthConfig>): AuthClientClass {
  const mergedConfig = mergeConfig(defaultConfig, config);
  client = new AuthClientClass(mergedConfig);
  return client;
}

/**
 * @description retrieves the current AuthClient instance.
 * @returns An instance of AuthClient.
 */
export function useAuthClient(): AuthClientClass {
  if (!client) throw new Error(AUTH_CLIENT_NOT_INITIALIZED);
  return client;
}

export type AuthClient = AuthClientClass;
export * from "./types";
export * from "./api";
