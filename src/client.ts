import { AUTH_AUTOLOGIN_DISABLED, AUTH_FAILED_TO_REFRESH, AUTH_TOKEN_INVALID } from "./conts";
import { AuthConfig, TokenInfo, Tokens } from "./types";
import { deleteCookie, extractInfoFromToken, getCookie, setCookie } from "./utils";

class AuthClient {
  private static instance: AuthClient | null = null;
  private config: AuthConfig;
  private tokens: Tokens | null = null;
  private tokenInfo: TokenInfo | null = null;
  private refreshTimeoutId: any;

  constructor(config: AuthConfig) {
    this.config = config;
    if (this.checkForTokens()) return;

    if (this.config.disableAutoLogin) {
      console.warn(AUTH_AUTOLOGIN_DISABLED);
      return;
    }

    this.auth("login");
  }

  public login() {
    this.auth("login");
  }

  public logout() {
    this.clearTokens();
    this.auth("logout");
  }

  public getToken(): string {
    if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
    return this.tokens!.accessToken;
  }

  public getTokenInfo(): TokenInfo {
    if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
    return this.tokenInfo!;
  }

  public getAuthHeaders(): Record<string, string> {
    if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
    return {
      Authorization: `Bearer ${this.tokens?.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private checkForTokens(): boolean {
    if (this.checkCookieForTokens()) return true;
    if (this.checkURLForTokens()) return true;
    console.warn("No tokens found in URL or cookies.");
    return false;
  }

  private setTokens(token: string, refreshToken: string | null = null) {
    try {
      this.tokens = {
        accessToken: token,
        refreshToken: refreshToken || null,
      };
      this.tokenInfo = extractInfoFromToken(token);
      setCookie(this.config.storageKey, token);
      setCookie(`${this.config.storageKey}_refresh`, refreshToken || "");
      this.scheduleExpiration();
    } catch (error) {
      console.error("Failed to set tokens:", error);
      this.clearTokens();
    }
  }

  private deleteCookies() {
    deleteCookie(this.config.storageKey);
    deleteCookie(`${this.config.storageKey}_refresh`);
  }

  /**
   * @param type "login" | "logout"
   * @description Redirects the user to the authentication URL for login or logout.
   * The URL will include the current page as the next parameter, along with database and application
   */
  private auth(type: "login" | "logout") {
    const params = new URLSearchParams({
      next: window.location.href,
      database: this.config.database || "",
      appName: this.config.application || "",
    });

    const authURL = new URL(`${this.config.authURL}/${type}`);
    authURL.search = params.toString();
    window.location.href = authURL.toString();
  }

  private async tryToRefreshToken(): Promise<boolean> {
    try {
      if (!this.tokens || !this.tokens.refreshToken) throw new Error(AUTH_FAILED_TO_REFRESH);

      const response = await fetch(`${this.config.authURL}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: this.tokens.refreshToken,
          database: this.config.database || "",
          appName: this.config.application || "",
        }),
      });

      if (!response.ok) throw new Error(AUTH_FAILED_TO_REFRESH);
      const data = await response.json();
      if (!data.access_token) throw new Error(AUTH_FAILED_TO_REFRESH);

      this.setTokens(data.access_token, data.refresh_token || null);
      console.log("Token refreshed successfully.");
      return true;
    } catch (error) {
      console.warn("Failed to refresh token:", error);
      return false;
    }
  }

  private scheduleExpiration() {
    this.clearTimers();
    if (!this.tokenInfo || !this.tokens) return;
    const { timeUntilExpiry } = this.tokenInfo;
    console.info("Token will expire in:", timeUntilExpiry.inMinutes, "minutes");
    if (timeUntilExpiry.inSeconds <= 0) return this.clearTokens();
    this.scheduleRefresh(timeUntilExpiry.inSeconds);
  }

  private scheduleRefresh(inSeconds: number) {
    const tenMinutes = 10 * 60; // 10 minutes in seconds
    const timeout = inSeconds - tenMinutes;
    if (inSeconds <= tenMinutes) {
      console.warn("Token will expire in less than 10 minutes. Attempting to refresh now.");
      this.tryToRefreshToken();
      return;
    }

    this.refreshTimeoutId = setTimeout(async () => {
      const success = await this.tryToRefreshToken();
      if (success) return;
      return this.clearTokens();
    }, timeout * 1000);
    console.info("Scheduled token refresh in:", timeout, "seconds");
  }

  private checkURLForTokens(): boolean {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("token");
    const refreshToken = params.get("refresh_token") || "";
    if (!accessToken) return false;
    this.setTokens(accessToken, refreshToken);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  private checkCookieForTokens(): boolean {
    const accessToken = getCookie(this.config.storageKey);
    const refreshToken = getCookie(`${this.config.storageKey}_refresh`);
    if (!accessToken) return false;
    this.setTokens(accessToken, refreshToken);
    return true;
  }

  private isTokenValid(): boolean {
    if (!this.tokens || !this.tokens.accessToken || !this.tokenInfo) return false;
    const { timeUntilExpiry } = this.tokenInfo;
    return timeUntilExpiry.inSeconds > 0;
  }

  private clearTokens() {
    this.tokens = null;
    this.tokenInfo = null;
    this.deleteCookies();
    this.clearTimers();
  }

  private clearTimers() {
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
  }

  public static getInstance(): AuthClient | null {
    if (AuthClient.instance) return AuthClient.instance;
    throw new Error("AuthClient instance does not exist. Use createInstance() to create it.");
  }

  public static createInstance(config: AuthConfig): AuthClient {
    if (!AuthClient.instance) {
      AuthClient.instance = new AuthClient(config);
      return AuthClient.instance;
    }
    throw new Error("AuthClient instance already exists. Use getInstance() to access it.");
  }
}

export const createAuthClient = (config: AuthConfig): AuthClient => {
  const instance = AuthClient.createInstance(config);
  return instance;
};

export const getAuthClient = (): AuthClient | null => {
  return AuthClient.getInstance();
};
