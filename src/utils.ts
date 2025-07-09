import type { AuthConfig, DefaultConfig, TokenInfo } from "./types";

/**
 * @param url - The URL string to check.
 * @returns The URL without a trailing slash if it exists.
 */
export const removeTrailingSlash = (url: string) => {
	return url.endsWith("/") ? url.slice(0, -1) : url;
};

/**
 * @param name - The name of the cookie to retrieve.
 * @description This function retrieves a cookie by its name from the document's cookies.
 * @returns The value of the cookie if found, or null if not found.
 */
export const getCookie = (name: string): string | null => {
	try {
		const cookieName = `${name}=`;
		const decodedCookie = decodeURIComponent(document.cookie);

		const ca = decodedCookie.split(";");
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === " ") {
				c = c.substring(1);
			}
			if (c.indexOf(cookieName) === 0) {
				return c.substring(cookieName.length, c.length);
			}
		}
		return null;
	} catch (error) {
		console.warn("Error getting cookie:", error);
		return null;
	}
};

/**
 * @param name - The name of the cookie to set.
 * @param value - The value of the cookie to set.
 * @description This function sets a cookie with the specified name and value, with an expiration of
 */
export const setCookie = (name: string, value: string): void => {
	try {
		const date = new Date();
		date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
		const expires = `expires=${date.toUTCString()}`;
		const cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict; Secure;`;
		document.cookie = cookie;
	} catch (error) {
		console.error("Error setting cookie:", error);
	}
};

/**
 * @param name - The name of the cookie to delete.
 * @description This function deletes a cookie by setting its expiration date to a past date.
 */
export const deleteCookie = (name: string): void => {
	try {
		const cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict; Secure;`;
		document.cookie = cookie;
	} catch (error) {
		console.error("Error deleting cookie:", error);
	}
};

/**
 * @param token - The JWT token string to extract information from.
 * @returns An object containing the time until expiry and user information.
 * @throws Will throw an error if the token is invalid or cannot be decoded.
 */
export const extractInfoFromToken = (token: string): TokenInfo => {
	const decoded = decodeJWT(token);

	const expirationDate = decoded.exp;
	const currentTime = Math.floor(Date.now() / 1000);
	const secondsUntilExpiry = expirationDate - currentTime;
	const minutesUntilExpiry = Math.floor(secondsUntilExpiry / 60);

	return {
		timeUntilExpiry: {
			inSeconds: secondsUntilExpiry,
			inMinutes: minutesUntilExpiry,
		},
		user: {
			id: decoded.sub || null,
			username: decoded.username || null,
			database: decoded.database || null,
			application: decoded.application || null,
		},
	};
};

/**
 * Decodes a JWT token string to extract its payload.
 * @param token - The JWT token string.
 * @returns The decoded payload as an object.
 */
export const decodeJWT = (token: string) => {
	// Split the JWT into its three parts
	const [header, payload, signature] = token.split(".");

	// Decode the payload
	const decodedPayload = base64UrlDecode(payload);

	// Parse the JSON string
	return JSON.parse(decodedPayload);
};

/**
 * Decodes a base64 URL-encoded string.
 * @param base64Url - The base64 URL-encoded string to decode.
 * @returns The decoded string.
 */
export const base64UrlDecode = (base64Url: string): string => {
	// Replace non-url-safe chars with base64 standard chars
	const base64Safe = base64Url.replace(/-/g, "+").replace(/_/g, "/");

	// Pad out with standard base64 required padding characters
	const pad = base64Safe.length % 4 === 0 ? "" : "=".repeat(4 - (base64Safe.length % 4));
	const base64 = base64Safe + pad;

	// Decode base64 string
	return atob(base64);
};

export const mergeConfig = (defaultConfig: DefaultConfig, config: Partial<AuthConfig> = {}): AuthConfig => {
	const requiredFields: (keyof AuthConfig)[] = ["authURL", "apiURL"];

	const missing = requiredFields.filter((field) => {
		const value = config[field];
		return value === undefined || value === null || value === "";
	});

	if (missing.length > 0) {
		throw new Error(`Missing required configuration fields: ${missing.join(", ")}`);
	}

	const authURL = removeTrailingSlash(config.authURL!);
	const apiURL = removeTrailingSlash(config.apiURL!);

	return {
		...defaultConfig,
		...config,
		authURL,
		apiURL,
	};
};
