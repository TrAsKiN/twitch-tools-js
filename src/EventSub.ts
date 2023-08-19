import { Api, ClientIdString, UserTokenString } from "./Api";

export type EventSubScope =
  | "moderator:read:followers"
  | "bits:read"
  | "channel:read:goals"
  | "channel:read:redemptions"
  | "channel:read:subscriptions"
  | "channel:read:polls"
  | "channel:read:predictions"
  | "channel:read:hype_train";

export type EventSubChannel =
  | "channel.follow"
  | "channel.subscribe"
  | "channel.subscription.gift"
  | "channel.subscription.message"
  | "channel.cheer"
  | "channel.raid"
  | "channel.channel_points_custom_reward_redemption.add"
  | "channel.goal.begin"
  | "channel.goal.progress"
  | "channel.goal.end"
  | "channel.poll.begin"
  | "channel.poll.progress"
  | "channel.poll.end"
  | "channel.prediction.begin"
  | "channel.prediction.progress"
  | "channel.prediction.lock"
  | "channel.prediction.end"
  | "channel.hype_train.begin"
  | "channel.hype_train.progress"
  | "channel.hype_train.end";

export class EventSub extends EventTarget {
  private socket: WebSocket;
  private sessionId: number | null;
  private keepaliveTimer: number | null;
  private lastMessageTimestamp: Date | null;
  private broadcasterId: number;
  private timer: number | null;
  private api: Api;
  private subscriptions: number[] = [];
  private url = "wss://eventsub.wss.twitch.tv/ws";

  constructor(clientId: ClientIdString, token: UserTokenString) {
    super();
    this.api = new Api(clientId, token);
  }

  public connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      console.debug(`EventSub connection open!`);
    };
    this.socket.onclose = () => {
      console.debug(`EventSub connection closed!`);
    };
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.metadata.message_type) {
        case "session_welcome":
          console.debug(`EventSub welcome message received!`);
          this.sessionId = data.payload.session.id;
          this.keepaliveTimer =
            data.payload.session.keepalive_timeout_seconds + 1;
          this.initiateTimer(data);
          this.api.call("/users").then((content) => {
            this.broadcasterId = content.data.shift().id;
            this.subscriptionTo(
              "channel.follow",
              {
                broadcaster_user_id: this.broadcasterId,
                moderator_user_id: this.broadcasterId,
              },
              "2"
            );
            this.subscriptionTo("channel.subscribe");
            this.subscriptionTo("channel.subscription.gift");
            this.subscriptionTo("channel.subscription.message");
            this.subscriptionTo("channel.cheer");
            this.subscriptionTo("channel.raid", {
              to_broadcaster_user_id: this.broadcasterId,
            });
            this.subscriptionTo("channel.raid", {
              from_broadcaster_user_id: this.broadcasterId,
            });
            this.subscriptionTo(
              "channel.channel_points_custom_reward_redemption.add"
            );
            this.subscriptionTo("channel.goal.begin");
            this.subscriptionTo("channel.goal.progress");
            this.subscriptionTo("channel.goal.end");
            this.subscriptionTo("channel.poll.begin");
            this.subscriptionTo("channel.poll.progress");
            this.subscriptionTo("channel.poll.end");
            this.subscriptionTo("channel.prediction.begin");
            this.subscriptionTo("channel.prediction.progress");
            this.subscriptionTo("channel.prediction.lock");
            this.subscriptionTo("channel.prediction.end");
            this.subscriptionTo("channel.hype_train.begin");
            this.subscriptionTo("channel.hype_train.progress");
            this.subscriptionTo("channel.hype_train.end");
            this.removeOldSubscribtions();
          });
          break;
        case "session_keepalive":
          console.debug(`EventSub connection still active...`);
          this.initiateTimer(data);
          break;
        case "session_reconnect":
          console.debug(`The EventSub server has requested to be reconnected!`);
          this.reconnect();
          break;
        case "notification":
          console.debug(`A new EventSub notification has just been received!`);
          this.initiateTimer(data);
          switch (data.metadata.subscription_type) {
            case "channel.follow":
              this.dispatchEvent(
                new CustomEvent("follow", { detail: data.payload.event })
              );
              break;
            case "channel.subscribe":
              this.dispatchEvent(
                new CustomEvent("sub", { detail: data.payload.event })
              );
              break;
            case "channel.subscription.gift":
              this.dispatchEvent(
                new CustomEvent("subgift", { detail: data.payload.event })
              );
              break;
            case "channel.subscription.message":
              this.dispatchEvent(
                new CustomEvent("resub", { detail: data.payload.event })
              );
              break;
            case "channel.cheer":
              this.dispatchEvent(
                new CustomEvent("cheer", { detail: data.payload.event })
              );
              break;
            case "channel.raid":
              if (data.payload.event.from_broadcaster_user_id) {
                this.dispatchEvent(
                  new CustomEvent("raid.exit", { detail: data.payload.event })
                );
              } else {
                this.dispatchEvent(
                  new CustomEvent("raid", { detail: data.payload.event })
                );
              }
              break;
            case "channel.channel_points_custom_reward_redemption.add":
              this.dispatchEvent(
                new CustomEvent("channelpoints", { detail: data.payload.event })
              );
              break;
            case "channel.goal.begin":
              this.dispatchEvent(
                new CustomEvent("goal.start", { detail: data.payload.event })
              );
              break;
            case "channel.goal.progress":
              this.dispatchEvent(
                new CustomEvent("goal.update", { detail: data.payload.event })
              );
              break;
            case "channel.goal.end":
              this.dispatchEvent(
                new CustomEvent("goal.end", { detail: data.payload.event })
              );
              break;
            case "channel.poll.begin":
              this.dispatchEvent(
                new CustomEvent("poll.start", { detail: data.payload.event })
              );
              break;
            case "channel.poll.progress":
              this.dispatchEvent(
                new CustomEvent("poll.update", { detail: data.payload.event })
              );
              break;
            case "channel.poll.end":
              this.dispatchEvent(
                new CustomEvent("poll.end", { detail: data.payload.event })
              );
              break;
            case "channel.prediction.begin":
              this.dispatchEvent(
                new CustomEvent("prediction.start", {
                  detail: data.payload.event,
                })
              );
              break;
            case "channel.prediction.progress":
              this.dispatchEvent(
                new CustomEvent("prediction.update", {
                  detail: data.payload.event,
                })
              );
              break;
            case "channel.prediction.lock":
              this.dispatchEvent(
                new CustomEvent("prediction.close", {
                  detail: data.payload.event,
                })
              );
              break;
            case "channel.prediction.end":
              this.dispatchEvent(
                new CustomEvent("prediction.end", {
                  detail: data.payload.event,
                })
              );
              break;
            case "channel.hype_train.begin":
              this.dispatchEvent(
                new CustomEvent("hype.start", { detail: data.payload.event })
              );
              break;
            case "channel.hype_train.progress":
              this.dispatchEvent(
                new CustomEvent("hype.update", { detail: data.payload.event })
              );
              break;
            case "channel.hype_train.end":
              this.dispatchEvent(
                new CustomEvent("hype.end", { detail: data.payload.event })
              );
              break;
          }
          break;
        default:
          console.debug(
            `EventSub message '${data.metadata.message_type}' not handled...`
          );
          this.dispatchEvent(new CustomEvent("message", { detail: data }));
      }
    };
  }

  private disconnect() {
    this.socket.close();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.sessionId = null;
    this.keepaliveTimer = null;
    this.lastMessageTimestamp = null;
    this.subscriptions.forEach((subscriptionId, index) => {
      this.api
        .call("/eventsub/subscriptions?id=" + subscriptionId, "DELETE")
        .then(() => this.subscriptions.splice(index, 1));
    });
  }

  private reconnect() {
    console.debug(`EventSub attempts to reconnect...`);
    this.disconnect();
    this.connect();
  }

  private initiateTimer(message: any) {
    if (this.keepaliveTimer === null) {
      return;
    }
    if (message.metadata) {
      this.lastMessageTimestamp = new Date(message.metadata.message_timestamp);
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(
      (() => {
        if (
          this.lastMessageTimestamp === null ||
          this.keepaliveTimer === null
        ) {
          return;
        }
        const now = new Date();
        const elapsedTime = now.getTime() - this.lastMessageTimestamp.getTime();
        if (elapsedTime > this.keepaliveTimer * 1000) {
          this.reconnect();
        } else {
          this.initiateTimer(message);
        }
      }).bind(this),
      this.keepaliveTimer * 1000
    );
  }

  private removeOldSubscribtions() {
    this.api.call("/eventsub/subscriptions").then((content) => {
      if (content.data.length > 0) {
        content.data.forEach(async (subscription: any) => {
          if (subscription.status !== "enabled") {
            this.api.call(
              "/eventsub/subscriptions?id=" + subscription.id,
              "DELETE"
            );
          }
        });
      }
    });
  }

  private subscriptionTo(
    channel: EventSubChannel,
    condition: {
      broadcaster_user_id?: number;
      moderator_user_id?: number;
      to_broadcaster_user_id?: number;
      from_broadcaster_user_id?: number;
    } | null = null,
    version = "1"
  ) {
    this.api
      .call(
        "/eventsub/subscriptions",
        "POST",
        JSON.stringify({
          type: channel,
          version: version,
          condition: condition ?? {
            broadcaster_user_id: this.broadcasterId,
          },
          transport: {
            method: "websocket",
            session_id: this.sessionId,
          },
        })
      )
      .then((content) => {
        console.debug(`Subscription to EventSub "${channel}" done!`);
        if (content.data.length > 0) {
          this.subscriptions.push(content.data.shift().id);
        }
      });
  }
}
