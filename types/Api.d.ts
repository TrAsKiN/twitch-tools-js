import { ChatScope } from "./Chat";
import { EventSubScope } from "./EventSub";
export type ClientIdString = string;
export type UserTokenString = string;
export type ScopesArray = (ChatScope | EventSubScope)[];
export declare class Api {
    private clientId;
    private token;
    private url;
    constructor(clientId: ClientIdString, token: UserTokenString);
    call(endpoint: string, method?: string, body?: BodyInit | null): Promise<any>;
    static generateAuthUrl(clientId: ClientIdString, scopes: ScopesArray): string;
    private parseResponse;
}
