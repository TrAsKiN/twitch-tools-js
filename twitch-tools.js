'use_strict'

export class Api {
    url

    constructor(clientId, token, dev = false) {
        this.clientId = clientId
        this.token = token
        this.url = !dev ? 'https://api.twitch.tv/helix' : 'http://localhost:8000/mock'
    }

    async call(endpoint, method = 'GET', body = null) {
        const headers = new Headers({
            'Authorization': 'Bearer '+ this.token,
            'Client-Id': this.clientId,
        })
        if (body) {
            headers.append('Content-Type', 'application/json')
        }
        const init = {
            method: method,
            headers: headers
        }
        if (body) {
            init.body = body
        }
        const response = await fetch(this.url + endpoint, init)
        return await this._parseResponse(response)
    }

    generateAuthUrl(scopes) {
        const record = {
            "client_id": this.clientId,
            "redirect_uri": document.location.href.split('#').shift()?.toString() ?? '',
            "response_type": "token",
            "scope": scopes.join("+")
        }
        return new URL('/oauth2/authorize?'+ decodeURIComponent(new URLSearchParams(record).toString()), 'https://id.twitch.tv/').href
    }

    async _parseResponse(response) {
        if (!response.ok) {
            console.debug(response)
            throw new Error(`HTTP error! Status: ${response.status}`)
        }
        if (response.status !== 204) {
            return await response.json()
        }
    }
}

export class Chat extends EventTarget {
    socket
    channel
    url = 'wss://irc-ws.chat.twitch.tv'

    constructor(token, nickname) {
        super()
        this.token = token
        this.nickname = nickname
    }

    connect(channel) {
        this.channel = `#${channel}`
        this.socket = new WebSocket(this.url)
        this.socket.onopen = event => {
            console.debug(`Connection open!`, event)
            this.socket.send(`PASS oauth:${this.token}`)
            this.socket.send(`NICK ${this.nickname}`)
            this.socket.send(`CAP REQ :twitch.tv/commands twitch.tv/tags twitch.tv/membership`)
            this.socket.send(`JOIN ${this.channel}`)
        }
        this.socket.onclose = event => {
            console.log(`Connection closed!`, event)
        }
        this.socket.onmessage = event => {
            const data = this._parseMessage(event.data)
            console.debug(data, event)
            if (data) {
                switch (data.command.command) {
                    case 'PING':
                        console.log(`Sending 'PONG :${data.parameters}'`)
                        this.socket.send(`PONG :${data.parameters}`)
                        break
                    case 'PRIVMSG':
                        console.log(`New chat message!`, data)
                        this.dispatchEvent(new CustomEvent('message', {detail: {
                            username: data.tags['display-name'],
                            content: data.parameters,
                            rawData: data
                        }}))
                        break
                    case 'JOIN':
                        console.log(`${data.source.nick} has join the chat!`)
                        this.dispatchEvent(new CustomEvent('join', {detail: {
                            username: data.source.nick,
                            rawData: data
                        }}))
                        break
                    case 'PART':
                        console.log(`${data.source.nick} has left the chat!`)
                        this.dispatchEvent(new CustomEvent('left', {detail: {
                            username: data.source.nick,
                            rawData: data
                        }}))
                        break
                }
            }
        }
    }

    _parseMessage(message) {
        let parsedMessage = {
            tags: null,
            source: null,
            command: null,
            parameters: null
        }

        let idx = 0

        let rawTagsComponent = null
        let rawSourceComponent = null
        let rawCommandComponent = null
        let rawParametersComponent = null

        if (message[idx] === '@') {
            let endIdx = message.indexOf(' ')
            rawTagsComponent = message.slice(1, endIdx)
            idx = endIdx + 1
        }

        if (message[idx] === ':') {
            idx += 1
            let endIdx = message.indexOf(' ', idx)
            rawSourceComponent = message.slice(idx, endIdx)
            idx = endIdx + 1
        }

        let endIdx = message.indexOf(':', idx)
        if (-1 == endIdx) {
            endIdx = message.length
        }

        rawCommandComponent = message.slice(idx, endIdx).trim()

        if (endIdx != message.length) {
            idx = endIdx + 1
            rawParametersComponent = message.slice(idx)
        }

        parsedMessage.command = this._parseCommand(rawCommandComponent)

        if (null == parsedMessage.command) {
            return null
        } else {
            if (null != rawTagsComponent) {
                parsedMessage.tags = this._parseTags(rawTagsComponent)
            }

            parsedMessage.source = this._parseSource(rawSourceComponent)

            parsedMessage.parameters = rawParametersComponent ? rawParametersComponent.trim() : rawParametersComponent
            if (rawParametersComponent && rawParametersComponent[0] === '!') {
                parsedMessage.command = this._parseParameters(rawParametersComponent, parsedMessage.command)
            }
        }

        return parsedMessage
    }

    _parseTags(tags) {
        const tagsToIgnore = {
            'client-nonce': null,
            'flags': null
        }

        let dictParsedTags = {}
        let parsedTags = tags.split(';')

        parsedTags.forEach(tag => {
            let parsedTag = tag.split('=')
            let tagValue = (parsedTag[1] === '') ? null : parsedTag[1]

            switch (parsedTag[0]) {
                case 'badges':
                case 'badge-info':
                    if (tagValue) {
                        let dict = {}
                        let badges = tagValue.split(',')
                        badges.forEach(pair => {
                            let badgeParts = pair.split('/')
                            dict[badgeParts[0]] = badgeParts[1]
                        })
                        dictParsedTags[parsedTag[0]] = dict
                    } else {
                        dictParsedTags[parsedTag[0]] = null
                    }
                    break
                case 'emotes':
                    if (tagValue) {
                        let dictEmotes = {}
                        let emotes = tagValue.split('/')
                        emotes.forEach(emote => {
                            let emoteParts = emote.split(':')

                            let textPositions = []
                            let positions = emoteParts[1].split(',')
                            positions.forEach(position => {
                                let positionParts = position.split('-')
                                textPositions.push({
                                    startPosition: positionParts[0],
                                    endPosition: positionParts[1]
                                })
                            })

                            dictEmotes[emoteParts[0]] = textPositions
                        })

                        dictParsedTags[parsedTag[0]] = dictEmotes
                    } else {
                        dictParsedTags[parsedTag[0]] = null
                    }
                    break
                case 'emote-sets':
                    let emoteSetIds = tagValue.split(',')
                    dictParsedTags[parsedTag[0]] = emoteSetIds
                    break
                default:
                    if (!tagsToIgnore.hasOwnProperty(parsedTag[0])) {
                        dictParsedTags[parsedTag[0]] = tagValue
                    }
            }
        })

        return dictParsedTags
    }

    _parseCommand(rawCommandComponent) {
        let parsedCommand = null
        let commandParts = rawCommandComponent.split(' ')

        switch (commandParts[0]) {
            case 'JOIN':
            case 'PART':
            case 'NOTICE':
            case 'CLEARCHAT':
            case 'HOSTTARGET':
            case 'PRIVMSG':
                parsedCommand = {
                    command: commandParts[0],
                    channel: commandParts[1]
                }
                break
            case 'PING':
                parsedCommand = {
                    command: commandParts[0]
                }
                break
            case 'CAP':
                parsedCommand = {
                    command: commandParts[0],
                    isCapRequestEnabled: (commandParts[2] === 'ACK') ? true : false,
                }
                break
            case 'GLOBALUSERSTATE':
                parsedCommand = {
                    command: commandParts[0]
                }
                break
            case 'USERSTATE':
            case 'ROOMSTATE':
                parsedCommand = {
                    command: commandParts[0],
                    channel: commandParts[1]
                }
                break
            case 'RECONNECT':
                console.log('The Twitch IRC server is about to terminate the connection for maintenance.')
                parsedCommand = {
                    command: commandParts[0]
                }
                break
            case '421':
                console.log(`Unsupported IRC command: ${commandParts[2]}`)
                return null
            case '001':
                parsedCommand = {
                    command: commandParts[0],
                    channel: commandParts[1]
                }
                break
            case '002':
            case '003':
            case '004':
            case '353':
            case '366':
            case '372':
            case '375':
            case '376':
                console.debug(`numeric message: ${commandParts[0]}`)
                return null
            default:
                console.log(`\nUnexpected command: ${commandParts[0]}\n`)
                return null
        }

        return parsedCommand
    }

    _parseSource(rawSourceComponent) {
        if (null == rawSourceComponent) {
            return null
        } else {
            let sourceParts = rawSourceComponent.split('!')
            return {
                nick: (sourceParts.length == 2) ? sourceParts[0] : null,
                host: (sourceParts.length == 2) ? sourceParts[1] : sourceParts[0]
            }
        }
    }

    _parseParameters(rawParametersComponent, command) {
        let idx = 0
        let commandParts = rawParametersComponent.slice(idx + 1).trim()
        let paramsIdx = commandParts.indexOf(' ')

        if (-1 == paramsIdx) {
            command.botCommand = commandParts.slice(0)
        }
        else {
            command.botCommand = commandParts.slice(0, paramsIdx)
            command.botCommandParams = commandParts.slice(paramsIdx).trim()
        }

        return command
    }
}

export class EventSub extends EventTarget {
    socket
    sessionId
    keepaliveTimer
    lastMessageTimestamp
    broadcasterId
    timer
    subscriptions = []
    api
    url

    constructor(clientId, token, dev = false) {
        super()
        this.clientId = clientId
        this.token = token
        this.api = new Api(this.clientId, this.token, dev)
        this.url = !dev ? 'wss://eventsub-beta.wss.twitch.tv/ws' : 'ws://localhost:8080/eventsub'
    }

    connect() {
        this.socket = new WebSocket(this.url)
        this.socket.onopen = event => {
            console.debug(`Connection open!`, event)
        }
        this.socket.onmessage = event => {
            let data = JSON.parse(event.data)
            switch (data.metadata.message_type) {
                case 'session_welcome':
                    this.sessionId = data.payload.session.id
                    this.keepaliveTimer = data.payload.session.keepalive_timeout_seconds + 1
                    this._initiateTimer(data)
                    this.api.call('/users')
                    .then(content => {
                        this.broadcasterId = content.data[0].id
                        this._subscriptionTo('channel.follow')
                        this._subscriptionTo('channel.subscribe')
                        this._subscriptionTo('channel.subscription.gift')
                        this._subscriptionTo('channel.subscription.message')
                        this._subscriptionTo('channel.cheer')
                        this._subscriptionTo('channel.raid')
                        this._subscriptionTo('channel.channel_points_custom_reward_redemption.add')
                        this._removeOldSubscribtions()
                    })
                    break
                case 'session_keepalive':
                    console.debug(`Connection still active...`, data)
                    this._initiateTimer(data)
                    break
                case 'notification':
                    console.log(`New notification!`, data)
                    this._initiateTimer(data)
                    switch (data.metadata.subscription_type) {
                        case 'channel.follow':
                            this.dispatchEvent(new CustomEvent('follow', {detail: data.payload.event}))
                            break
                        case 'channel.subscribe':
                            this.dispatchEvent(new CustomEvent('sub', {detail: data.payload.event}))
                            break
                        case 'channel.subscription.gift':
                            this.dispatchEvent(new CustomEvent('subgift', {detail: data.payload.event}))
                            break
                        case 'channel.subscription.message':
                            this.dispatchEvent(new CustomEvent('resub', {detail: data.payload.event}))
                            break
                        case 'channel.cheer':
                            this.dispatchEvent(new CustomEvent('cheer', {detail: data.payload.event}))
                            break
                        case 'channel.raid':
                            this.dispatchEvent(new CustomEvent('raid', {detail: data.payload.event}))
                            break
                        case 'channel.channel_points_custom_reward_redemption.add':
                            this.dispatchEvent(new CustomEvent('channelpoints', {detail: data.payload.event}))
                            break
                        case 'channel.goal.begin':
                            this.dispatchEvent(new CustomEvent('goal.start', {detail: data.payload.event}))
                            break
                        case 'channel.goal.progress':
                            this.dispatchEvent(new CustomEvent('goal.update', {detail: data.payload.event}))
                            break
                        case 'channel.goal.end':
                            this.dispatchEvent(new CustomEvent('goal.end', {detail: data.payload.event}))
                            break
                    }
                    break
                default:
                    console.log(data)
            }
        }
    }

    disconnect() {
        this.socket.close()
        clearTimeout(this.timer)
        this.timer = null
        this.sessionId = null
        this.keepaliveTimer = null
        this.lastMessageTimestamp = null
        this.subscriptions.forEach((subscriptionId, index) => {
            this.api.call('/eventsub/subscriptions?id=' + subscriptionId, 'DELETE')
            .then(() => this.subscriptions.splice(index, 1))
        })
    }

    reconnect() {
        console.log(`Reconnection...`)
        this.disconnect()
        this.connect()
    }

    _initiateTimer(message) {
        if (message.metadata) {
            this.lastMessageTimestamp = new Date(message.metadata.message_timestamp)
        }
        if (this.timer) {
            clearTimeout(this.timer)
        }
        this.timer = setTimeout((() => {
            const now = new Date()
            const elapsedTime = now.getTime() - this.lastMessageTimestamp.getTime()
            if (elapsedTime > (this.keepaliveTimer * 1000)) {
                this.reconnect()
            } else {
                this._initiateTimer(message)
            }
        }).bind(this), this.keepaliveTimer * 1000)
    }

    _removeOldSubscribtions() {
        this.api.call('/eventsub/subscriptions')
        .then(content => {
            if (content.data.length > 0) {
                content.data.forEach(async subscription => {
                    if (subscription.status !== 'enabled') {
                        this.api.call('/eventsub/subscriptions?id=' + subscription.id, 'DELETE')
                    }
                })
            }
        })
    }

    _subscriptionTo(channel) {
        this.api.call('/eventsub/subscriptions', 'POST', JSON.stringify({
            "type": channel,
            "version": "1",
            "condition": {
                "broadcaster_user_id": this.broadcasterId,
                "to_broadcaster_user_id": this.broadcasterId
            },
            "transport": {
                "method": "websocket",
                "session_id": this.sessionId
            }
        }))
        .then(content => {
            console.log(`Subscription to "${channel}" done!`, content)
            if (content.data.length > 0) {
                this.subscriptions.push(content.data[0].id)
            }
        })
    }
}
