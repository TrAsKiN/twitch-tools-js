import { ClientIdString, UserTokenString } from "./Api";
export type EventSubScope = "moderator:read:followers" | "bits:read" | "channel:read:goals" | "channel:read:redemptions" | "channel:read:subscriptions" | "channel:read:polls" | "channel:read:predictions" | "channel:read:hype_train";
export type EventSubChannel = "channel.follow" | "channel.subscribe" | "channel.subscription.gift" | "channel.subscription.message" | "channel.cheer" | "channel.raid" | "channel.channel_points_custom_reward_redemption.add" | "channel.goal.begin" | "channel.goal.progress" | "channel.goal.end" | "channel.poll.begin" | "channel.poll.progress" | "channel.poll.end" | "channel.prediction.begin" | "channel.prediction.progress" | "channel.prediction.lock" | "channel.prediction.end" | "channel.hype_train.begin" | "channel.hype_train.progress" | "channel.hype_train.end";
export declare class EventSub extends EventTarget {
    private socket;
    private sessionId;
    private keepaliveTimer;
    private lastMessageTimestamp;
    private broadcasterId;
    private timer;
    private api;
    private subscriptions;
    private url;
    constructor(clientId: ClientIdString, token: UserTokenString);
    connect(): void;
    private disconnect;
    private reconnect;
    private initiateTimer;
    private removeOldSubscribtions;
    private subscriptionTo;
}
