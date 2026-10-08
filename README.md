# brc100-wallet-chooser

A standard "Connect a wallet" panel for BRC-100 apps. It finds every wallet on the user's machine and lets the user pick one.

Today `new WalletClient('auto')` connects to the first wallet that answers, and a browser extension always wins. If someone runs BSV Desktop and also has Yours or bWalletX installed, apps never reach BSV Desktop. This panel lists them all instead.

It finds:

- **Wallets that announce themselves** with the `brc100:announceWallet` event ([draft standard](docs/BRC-DRAFT-wallet-discovery.md)).
- **Extensions that only set `window.CWI`**, named from their `getVersion()`.
- **Desktop wallets** on `localhost:3321` and `localhost:2121` (BSV Desktop, Metanet Client and others).
- **The host wallet** when the page is opened inside a wallet's in-app browser.

## Use it

```ts
import { connectWallet, switchWallet } from 'brc100-wallet-chooser'

// Reconnects to the wallet chosen on this site last time, otherwise shows the panel.
const { wallet, identityKey, name } = await connectWallet({ helpUrl: 'https://example.com/wallets' })

// For a "Switch wallet" button: always shows the panel.
await switchWallet()
```

`wallet` is a BRC-100 `WalletInterface`. Use it directly or pass it to `new WalletClient(wallet, originator)`.

The panel is a framework-free custom element (`<brc100-wallet-chooser>`), so it works in React, Vue, Svelte or plain HTML. It follows light and dark mode. Theme it with CSS custom properties: `--brc100-bg`, `--brc100-fg`, `--brc100-muted`, `--brc100-line`, `--brc100-hover`, `--brc100-accent`, `--brc100-danger`, `--brc100-radius` and `--brc100-font`. Set `theme="light"` or `theme="dark"` on the element to force a theme.

## For wallet developers

Announce your wallet so apps can list it under its own name and icon:

```ts
import { announceWallet } from 'brc100-wallet-chooser'

announceWallet({ name: 'My Wallet', icon: 'data:image/svg+xml;base64,…', rdns: 'com.example.wallet', kind: 'extension' }, walletImpl)
```

Please also return your own name from `getVersion()`, and only set `window.CWI` if it's empty.

## Demo

```sh
pnpm install
pnpm exec vite --port 5199   # then open http://localhost:5199/demo/
```

## Status

This is a draft for discussion. A matching `discoverWallets()` / `announceWallet()` is proposed for `@bsv/sdk`.

MIT licence.
