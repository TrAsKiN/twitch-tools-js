'use_strict'

export class Api {
  #clientId
  #token
  #url = 'https://api.twitch.tv/helix'

  constructor(clientId, token) {
    this.#clientId = clientId
    this.#token = token
  }

  async call(endpoint, method = 'GET', body = null) {
    const headers = new Headers({
      'Authorization': 'Bearer '+ this.#token,
      'Client-Id': this.#clientId,
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
    const response = await fetch(this.#url + endpoint, init)
    return await this.#parseResponse(response)
  }

  static generateAuthUrl(clientId, scopes) {
    const options = {
      "client_id": clientId,
      "redirect_uri": document.location.href.split('#').shift().toString(),
      "response_type": "token",
      "scope": scopes.join("+")
    }
    const params = new URLSearchParams(options)
    return new URL('/oauth2/authorize?'+ decodeURIComponent(params.toString()), 'https://id.twitch.tv/').href
  }

  async #parseResponse(response) {
    if (!response.ok) {
      console.debug(response)
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    if (response.status !== 204) {
      return await response.json()
    }
  }
}
