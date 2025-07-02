import { AbortableAPIService } from "@emilgramdk/utils";
import { AuthClient } from "./client";

export class AuthAPIService extends AbortableAPIService {
  private authClient: AuthClient;
  private baseURL: string = "";

  constructor(authClient: AuthClient) {
    super();
    this.authClient = authClient;
    this.baseURL = authClient.getConfig().apiURL;
  }

  protected async fetch<T>(key: string, url: string, options: RequestInit = {}): Promise<T> {
    options.headers = {
      ...(options.headers || {}),
      ...this.authClient.getAuthHeaders(),
    };
    return this.fetch<T>(key, `${this.baseURL}/${url}`, options);
  }
}
