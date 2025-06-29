import { createAuthClient } from "./client";
import { AuthConfig, DefaultConfig } from "./types";
import { mergeConfig } from "./utils";

const defaultConfig: DefaultConfig = {
  storageKey: "authToken",
  application: "default",
  disableAutoLogin: false,
};

/**
 *
 * @param config Partial configuration for the AuthClient.
 * Merges the provided config with the default configuration and initializes the AuthClient.
 * If the `disableAutoLogin` flag is set to true, the client will not attempt to log in automatically.
 */
export function useAuthClient(config: Partial<AuthConfig>): AuthClient {
  const mergedConfig = mergeConfig(defaultConfig, config);
  return createAuthClient(mergedConfig);
}

export type AuthClient = ReturnType<typeof createAuthClient>;

export * from "./types";
