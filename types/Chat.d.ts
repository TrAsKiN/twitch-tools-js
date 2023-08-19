import { ClientIdString, UserTokenString } from "./Api";
export type ChatScope = "chat:edit" | "chat:read";
export declare class Chat extends EventTarget {
    private token;
    scopes: ChatScope[];
    private socket;
    private api;
    private nickname;
    private url;
    constructor(clientId: ClientIdString, token: UserTokenString);
    connect(): void;
    private parseMessage;
    private parseTags;
    private parseCommand;
    private parseSource;
    private parseParameters;
}
