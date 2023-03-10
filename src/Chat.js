'use_strict'

import { Api } from './Api'

export class Chat extends EventTarget {
  #socket
  #token
  #api
  #nickname
  #url = 'wss://irc-ws.chat.twitch.tv'

  constructor(clientId, token) {
    super()
    this.#token = token
    this.#api = new Api(clientId, token)
    this.#api.call('/users')
      .then(content => {
        this.#nickname = content.data[0].login
      })
  }

  static getScopes() {
    return [
      'chat:edit',
      'chat:read',
    ]
  }

  connect() {
    this.#socket = new WebSocket(this.#url)
    this.#socket.onopen = () => {
      console.debug(`Chat connection open!`)
      this.#socket.send(`PASS oauth:${this.#token}`)
      this.#socket.send(`NICK ${this.#nickname}`)
      this.#socket.send(`CAP REQ :twitch.tv/commands twitch.tv/tags twitch.tv/membership`)
      this.#socket.send(`JOIN #${this.#nickname}`)
    }
    this.#socket.onclose = () => {
      console.debug(`Chat connection closed!`)
    }
    this.#socket.onmessage = event => {
      const data = this.#parseMessage(event.data)
      if (data) {
        switch (data.command.command) {
        case '001':
          console.debug(`Chat welcome message received!`)
          this.dispatchEvent(new CustomEvent('RPL_WELCOME', {detail: {
            rawData: data
          }}))
          break
        case '353':
          console.debug(`Chat reply with list of users and their status!`)
          this.dispatchEvent(new CustomEvent('RPL_NAMREPLY', {detail: {
            rawData: data
          }}))
          break
        case 'PING':
          console.debug(`Chat PING received, sending PONG!`)
          this.#socket.send(`PONG :${data.parameters}`)
          this.dispatchEvent(new CustomEvent('ping', {detail: {
            rawData: data
          }}))
          break
        case 'PRIVMSG':
          console.debug(`A new chat message has just been received!`)
          this.dispatchEvent(new CustomEvent('message', {detail: {
            username: data.tags['display-name'],
            content: data.parameters,
            rawData: data
          }}))
          break
        case 'JOIN':
          console.debug(`${data.source.nick} has join the chat!`)
          this.dispatchEvent(new CustomEvent('join', {detail: {
            username: data.source.nick,
            rawData: data
          }}))
          break
        case 'PART':
          console.debug(`${data.source.nick} has left the chat!`)
          this.dispatchEvent(new CustomEvent('left', {detail: {
            username: data.source.nick,
            rawData: data
          }}))
          break
        case 'USERSTATE':
          console.debug(`Just joined a channel or sent a message.`)
          break
        default:
          console.debug(`Chat command '${data.command.command}' not handled...`)
          this.dispatchEvent(new CustomEvent('command', {detail: {
            rawData: data
          }}))
        }
      }
    }
  }

  #parseMessage(message) {
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
    parsedMessage.command = this.#parseCommand(rawCommandComponent)
    if (null == parsedMessage.command) {
      return null
    } else {
      if (null != rawTagsComponent) {
        parsedMessage.tags = this.#parseTags(rawTagsComponent)
      }
      parsedMessage.source = this.#parseSource(rawSourceComponent)
      parsedMessage.parameters = rawParametersComponent ? rawParametersComponent.trim() : rawParametersComponent
      if (rawParametersComponent && rawParametersComponent[0] === '!') {
        parsedMessage.command = this.#parseParameters(rawParametersComponent, parsedMessage.command)
      }
    }
    return parsedMessage
  }

  #parseTags(tags) {
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

  #parseCommand(rawCommandComponent) {
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
      console.debug('The Twitch IRC server is about to terminate the connection for maintenance.')
      parsedCommand = {
        command: commandParts[0]
      }
      break
    case '421':
      console.debug(`Unsupported IRC command: ${commandParts[2]}`)
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
      console.debug(`IRC numeric message: ${commandParts[0]}`)
      return null
    case '353':
    case '366':
      parsedCommand = {
        command: commandParts[0],
        channel: commandParts[1]
      }
      break
    case '372':
    case '375':
    case '376':
      console.debug(`IRC numeric message: ${commandParts[0]}`)
      return null
    default:
      console.debug(`Unexpected command: ${commandParts[0]}`)
      return null
    }
    return parsedCommand
  }

  #parseSource(rawSourceComponent) {
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

  #parseParameters(rawParametersComponent, command) {
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
