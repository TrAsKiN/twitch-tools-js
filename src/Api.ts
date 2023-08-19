import { ChatScope } from "./Chat";
import { EventSubScope } from "./EventSub";

export type ClientIdString = string;
export type UserTokenString = string;
export type ScopesArray = (ChatScope | EventSubScope)[];

export class Api {
  private url = "https://api.twitch.tv/helix";

  constructor(
    private clientId: ClientIdString,
    private token: UserTokenString
  ) {}

  public async call(
    endpoint: string,
    method = "GET",
    body: BodyInit | null = null
  ) {
    const headers = new Headers({
      Authorization: "Bearer " + this.token,
      "Client-Id": this.clientId,
    });
    if (body) {
      headers.append("Content-Type", "application/json");
    }
    const init: RequestInit = {
      method: method,
      headers: headers,
    };
    if (body) {
      init.body = body;
    }
    const response = await fetch(this.url + endpoint, init);
    return this.parseResponse(response);
  }

  public static generateAuthUrl(clientId: ClientIdString, scopes: ScopesArray) {
    const options = {
      client_id: clientId,
      redirect_uri:
        document?.location?.href?.split("#")?.shift()?.toString() ?? "",
      response_type: "token",
      scope: scopes.join("+"),
    };
    const params = new URLSearchParams(options);
    return new URL(
      "/oauth2/authorize?" + decodeURIComponent(params.toString()),
      "https://id.twitch.tv/"
    ).href;
  }

  private parseResponse(response: Response): Promise<any | null> {
    if (!response.ok) {
      console.debug(response);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    if (response.status !== 204) {
      return response.json();
    }
    return new Promise<null>((resolve) => {
      resolve(null);
    });
  }
}
