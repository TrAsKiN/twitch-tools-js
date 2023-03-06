# Twitch Tools JS

[![Publish Package to npmjs.org](https://github.com/TrAsKiN/twitch-tools-js/actions/workflows/publish-package.yaml/badge.svg)](https://github.com/TrAsKiN/twitch-tools-js/actions/workflows/publish-package.yaml)

This project is a JavaScript tool designed to handle Twitch and chat events, as well as Twitch API calls. The tools are designed to be used directly in the browser through WebSocket connections.

## Features

- Twitch events (EventSub via WebSocket)
- Chat events (IRC via WebSocket)
- Twitch API calls

## Installation

### CDN

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@traskin/twitch-tools-js@1.0/twitch-tools.js"></script>
<script type="module">
    import { Api, Chat, EventSub } from 'https://cdn.jsdelivr.net/npm/@traskin/twitch-tools-js@1.0/twitch-tools.js'
</script>
```

### NPM

```shell
npm install @traskin/twitch-tools-js
```

```html
<script type="module">
    import { Api, Chat, EventSub } from './node_modules/@traskin/twitch-tools-js/twitch-tools.js'
</script>
```

## Usage

See our [documentation](https://github.com/TrAsKiN/twitch-tools-js/wiki).

## Contributing

We welcome contributions to this project. Please feel free to fork the repository and submit a pull request.
