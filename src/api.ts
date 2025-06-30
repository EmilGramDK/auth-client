import { AbortableAPIService } from "@emilgramdk/utils";
import { useAuthClient } from ".";

export class APIClientService extends AbortableAPIService {
  private authClient = useAuthClient();

  protected async fetch<T>(key: string, url: string, options: RequestInit = {}): Promise<T> {
    options.headers = this.authClient.getAuthHeaders();
    return super.fetch<T>(key, url, options);
  }
}
