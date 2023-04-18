type ScopeString = string;
type ScopesArray = ScopeString[];
type ClientIdString = string;
type UserTokenString = string;

declare module "@traskin/twitch-tools-js" {
  export class Api {
    constructor(clientId: ClientIdString, token: UserTokenString);
    call(endpoint: string, method: string, body: BodyInit): object;
    static generateAuthUrl(
      clientId: ClientIdString,
      scopes: ScopesArray
    ): string;
  }

  export class Chat extends EventTarget {
    constructor(clientId: ClientIdString, token: UserTokenString);
    static getScopes(): ScopesArray;
    connect(): void;
  }

  export class EventSub extends EventTarget {
    constructor(clientId: ClientIdString, token: UserTokenString);
    static getScopes(): ScopesArray;
    connect(): void;
  }
}
