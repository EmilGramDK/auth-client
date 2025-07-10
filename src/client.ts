import { AUTH_AUTOLOGIN_DISABLED, AUTH_FAILED_TO_REFRESH, AUTH_TOKEN_INVALID } from "./conts";
import type { AuthConfig, TokenInfo, Tokens } from "./types";
import { deleteCookie, extractInfoFromToken, getCookie, setCookie } from "./utils";

export class AuthClientClass {
	private config: AuthConfig;
	private tokens: Tokens | null = null;
	private tokenInfo: TokenInfo | null = null;
	private refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

	constructor(config: AuthConfig) {
		this.config = config;
		if (this.checkForTokens()) return;

		if (this.config.disableAutoLogin) {
			console.warn(AUTH_AUTOLOGIN_DISABLED);
			return;
		}

		this.login();
	}

	public getConfig(): AuthConfig {
		return this.config;
	}

	/**
	 * @description Attempts to log in the user by redirecting them to the authentication URL.
	 */
	public login() {
		this.auth("login");
	}

	/**
	 * @description Logs out the user by clearing tokens and redirecting to the logout URL.
	 * It also deletes the cookies associated with the tokens.
	 */
	public logout() {
		this.clearTokens();
		this.auth("logout");
	}

	/**
	 * @returns the access token if it is valid.
	 * @throws Error if the token is invalid.
	 * @description Returns the access token if it is valid, otherwise throws an error.
	 * It checks if the token is valid by calling `isTokenValid()`.
	 */
	public getToken(): string {
		if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
		return this.tokens!.accessToken;
	}

	/**
	 * @returns the token information if the token is valid.
	 * @throws Error if the token is invalid.
	 * @description Returns the token information if it is valid, otherwise throws an error.
	 * It checks if the token is valid by calling `isTokenValid()`.
	 */
	public getTokenInfo(): TokenInfo {
		if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
		return this.tokenInfo!;
	}

	/**
	 * @returns an object containing the Authorization header with the Bearer token and Content-Type.
	 * @throws Error if the token is invalid.
	 * @description Returns the headers required for authenticated requests.
	 * It includes the Authorization header with the Bearer token and Content-Type set to application/json.
	 * It checks if the token is valid by calling `isTokenValid()`.
	 */
	public getAuthHeaders(): Record<string, string> {
		if (!this.isTokenValid()) throw new Error(AUTH_TOKEN_INVALID);
		return {
			Authorization: `Bearer ${this.tokens?.accessToken}`,
			"Content-Type": "application/json",
		};
	}

	/**
	 * @returns true if tokens are found and set, false otherwise.
	 * @description Checks for tokens in cookies or URL parameters.
	 * If tokens are found, they are set and the expiration is scheduled.
	 * If no tokens are found, it returns false and logs a warning.
	 */
	private checkForTokens(): boolean {
		if (this.checkCookieForTokens()) return true;
		if (this.checkURLForTokens()) return true;
		console.warn("No tokens found in URL or cookies.");
		return this.isTokenValid();
	}

	/**
	 *
	 * @param token string
	 * @param refreshToken string | null
	 * @description Sets the access token and refresh token.
	 * It also extracts token information and schedules the expiration.
	 * If an error occurs during this process, it clears the tokens and logs the error.
	 */
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
		this.clearTokens();
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
}

export type AuthClient = AuthClientClass;
