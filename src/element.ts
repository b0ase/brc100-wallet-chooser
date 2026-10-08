/**
 * <brc100-wallet-chooser>: the standard chooser panel (BRC draft §4).
 * Framework-free custom element in a shadow root; theme it with CSS custom properties.
 */
import type { WalletInterface } from '@bsv/sdk'
import { discoverWallets, inFrame, type DiscoverOptions, type DiscoveredWallet, type WalletKind } from './discovery.js'

export interface ConnectedWallet {
  wallet: WalletInterface
  identityKey: string
  rdns: string
  name: string
  kind: WalletKind
}

export interface ChooserOptions extends DiscoverOptions {
  /** "Don't see your wallet?" link. */
  helpUrl?: string
  /** Storage key for the remembered choice. Default "brc100.wallet". Set null to never remember. */
  rememberKey?: string | null
  /** Override UI strings (localisation). */
  labels?: Partial<typeof LABELS>
}

const LABELS = {
  title: 'Connect a wallet',
  connectingFrom: 'Connecting from',
  refresh: 'Refresh',
  searching: 'Looking for wallets…',
  help: "Don't see your wallet?",
  empty: 'No BRC-100 wallet found on this device.',
  lastUsed: 'Last used',
  gone: (name: string) => `${name} is not available any more.`,
  connecting: 'Waiting for approval…',
  close: 'Close',
  kind: {
    extension: 'Browser extension',
    desktop: 'This computer',
    'in-app': 'This app',
    web: 'Web wallet',
    mobile: 'Phone',
    other: 'Wallet'
  } satisfies Record<WalletKind, string>
}

const GROUP: Record<WalletKind, number> = { 'in-app': 0, extension: 1, desktop: 2, mobile: 3, web: 4, other: 5 }

/** The remembered choice: rdns and display name only, never keys. */
const rememberedWallet = (key: string | null): { rdns: string, name: string } | null => {
  if (key == null) return null
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return typeof v?.rdns === 'string' ? { rdns: v.rdns, name: String(v.name ?? v.rdns) } : null
  } catch { return null }
}
const remembered = (key: string | null): string | null => rememberedWallet(key)?.rdns ?? null
const remember = (key: string | null, w: DiscoveredWallet): void => {
  if (key == null) return
  try { localStorage.setItem(key, JSON.stringify({ rdns: w.rdns, name: w.name })) } catch { /* storage blocked: the panel shows again next time */ }
}

/** Last used first, then by kind group, then by name. Never by anything else (§4.4). */
export function orderWallets (list: DiscoveredWallet[], lastRdns: string | null): DiscoveredWallet[] {
  return [...list].sort((a, b) =>
    Number(b.rdns === lastRdns) - Number(a.rdns === lastRdns) ||
    GROUP[a.kind] - GROUP[b.kind] ||
    a.name.localeCompare(b.name))
}

async function identify (w: DiscoveredWallet): Promise<ConnectedWallet> {
  const { publicKey } = await w.wallet.getPublicKey({ identityKey: true })
  return { wallet: w.wallet, identityKey: publicKey, rdns: w.rdns, name: w.name, kind: w.kind }
}

const STYLE = `
:host { all: initial; position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
  font: 15px/1.4 var(--brc100-font, system-ui, -apple-system, sans-serif);
  --bg: var(--brc100-bg, #fff); --fg: var(--brc100-fg, #111); --muted: var(--brc100-muted, #666);
  --line: var(--brc100-line, #e4e4e7); --hover: var(--brc100-hover, #f4f4f5); --accent: var(--brc100-accent, #2563eb);
  --danger: var(--brc100-danger, #dc2626); --radius: var(--brc100-radius, 14px); }
@media (prefers-color-scheme: dark) { :host(:not([theme=light])) {
  --bg: var(--brc100-bg, #18181b); --fg: var(--brc100-fg, #fafafa); --muted: var(--brc100-muted, #a1a1aa);
  --line: var(--brc100-line, #3f3f46); --hover: var(--brc100-hover, #27272a); --accent: var(--brc100-accent, #60a5fa); } }
:host([theme=dark]) { --bg: var(--brc100-bg, #18181b); --fg: var(--brc100-fg, #fafafa); --muted: var(--brc100-muted, #a1a1aa);
  --line: var(--brc100-line, #3f3f46); --hover: var(--brc100-hover, #27272a); --accent: var(--brc100-accent, #60a5fa); }
.scrim { position: absolute; inset: 0; background: rgb(0 0 0 / .45); }
.panel { position: relative; width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
  background: var(--bg); color: var(--fg); border-radius: var(--radius); box-shadow: 0 20px 60px rgb(0 0 0 / .3); padding: 20px; box-sizing: border-box; }
header { display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.origin { margin: 4px 0 16px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.origin b { color: var(--fg); font-weight: 500; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.x { font-size: 22px; line-height: 1; padding: 4px 8px; border-radius: 8px; color: var(--muted); }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.row { width: 100%; display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 12px; text-align: left;
  padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
.row:hover, .row:focus-visible { background: var(--hover); outline: none; border-color: var(--accent); }
.row[aria-busy=true] { cursor: progress; }
.icon { width: 40px; height: 40px; border-radius: 9px; object-fit: cover; background: var(--hover);
  display: grid; place-items: center; font-weight: 600; color: var(--muted); }
.name { font-weight: 500; }
.meta { color: var(--muted); font-size: 13px; }
.tag { font-size: 11px; padding: 2px 6px; border-radius: 99px; background: var(--hover); color: var(--muted); margin-left: 6px; }
.err { color: var(--danger); font-size: 13px; grid-column: 2 / 4; }
.chev { color: var(--muted); }
.note { margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; background: var(--hover); font-size: 13px; }
.status { color: var(--muted); padding: 16px 0; text-align: center; }
footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; font-size: 14px; }
footer button { color: var(--accent); padding: 6px 0; }
footer a { color: var(--muted); }
`

export class BRC100WalletChooser extends HTMLElement {
  options: ChooserOptions = {}
  private readonly root = this.attachShadow({ mode: 'open' })
  private wallets: DiscoveredWallet[] = []
  private searching = false
  private note: string | null = null
  private busy: string | null = null
  private readonly errors = new Map<string, string>()
  private resolve?: (w: ConnectedWallet) => void
  private reject?: (e: Error) => void
  private returnFocus: Element | null = null

  private get labels (): typeof LABELS { return { ...LABELS, ...this.options.labels } }
  private get rememberKey (): string | null { return this.options.rememberKey === undefined ? 'brc100.wallet' : this.options.rememberKey }

  /** Open the panel and resolve with the wallet the user picks. Rejects if they close it. */
  async open (note: string | null = null): Promise<ConnectedWallet> {
    this.note = note
    this.returnFocus = document.activeElement
    if (!this.isConnected) document.body.appendChild(this)
    const done = new Promise<ConnectedWallet>((resolve, reject) => { this.resolve = resolve; this.reject = reject })
    void this.refresh()
    return await done
  }

  close (reason = 'User closed the wallet chooser'): void {
    this.reject?.(Object.assign(new Error(reason), { code: 'USER_CANCELLED' }))
    this.finish()
  }

  async refresh (): Promise<void> {
    this.searching = true
    this.errors.clear()
    this.render()
    this.wallets = orderWallets(await discoverWallets(this.options), remembered(this.rememberKey))
    this.searching = false
    this.render()
    ;(this.root.querySelector('.row') as HTMLElement | null)?.focus()
  }

  private async pick (w: DiscoveredWallet): Promise<void> {
    if (this.busy != null) return
    this.busy = w.rdns
    this.errors.delete(w.rdns)
    this.render()
    try {
      const connected = await identify(w)
      remember(this.rememberKey, w)
      this.resolve?.(connected)
      this.finish()
    } catch (e) {
      // A locked wallet refuses: that means "unlock me", not "not installed".
      this.errors.set(w.rdns, `${e instanceof Error ? e.message : String(e)}. Unlock ${w.name} and try again.`)
      this.busy = null
      this.render()
    }
  }

  private finish (): void {
    this.resolve = undefined
    this.reject = undefined
    this.busy = null
    this.remove()
    ;(this.returnFocus as HTMLElement | null)?.focus?.()
  }

  connectedCallback (): void {
    this.addEventListener('keydown', this.onKey)
  }

  disconnectedCallback (): void {
    this.removeEventListener('keydown', this.onKey)
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return }
    const focusables = [...this.root.querySelectorAll<HTMLElement>('button, a[href]')]
    const i = focusables.indexOf(this.root.activeElement as HTMLElement)
    const rows = [...this.root.querySelectorAll<HTMLElement>('.row')]
    const r = rows.indexOf(this.root.activeElement as HTMLElement)
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && r !== -1) {
      e.preventDefault()
      rows[(r + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length].focus()
    } else if (e.key === 'Tab' && focusables.length > 0) {
      // Keep focus inside the dialog.
      const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i + 1) % focusables.length
      e.preventDefault()
      focusables[next].focus()
    }
  }

  private render (): void {
    const L = this.labels
    const last = remembered(this.rememberKey)
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] => {
      const n = document.createElement(tag)
      for (const [k, v] of Object.entries(props)) {
        if (k.startsWith('aria-') || k === 'role') n.setAttribute(k, String(v))
        else (n as unknown as Record<string, unknown>)[k] = v
      }
      n.append(...kids)
      return n
    }

    const title = el('h2', { id: 'title' }, L.title)
    const header = el('header', {}, title, el('button', { className: 'x', 'aria-label': L.close, onclick: () => this.close() }, '×'))
    const origin = el('p', { className: 'origin' }, `${L.connectingFrom} `, el('b', {}, this.options.originator ?? window.location.host))

    const body: Node[] = []
    if (this.note != null) body.push(el('p', { className: 'note', role: 'status' }, this.note))
    if (this.searching && this.wallets.length === 0) {
      body.push(el('p', { className: 'status', role: 'status' }, L.searching))
    } else if (this.wallets.length === 0) {
      body.push(el('p', { className: 'status' }, L.empty))
    } else {
      body.push(el('ul', {}, ...this.wallets.map(w => {
        // Icons only ever go in <img src>: an SVG there cannot run script in this page.
        const icon = w.icon != null
          ? el('img', { className: 'icon', src: w.icon, alt: '' })
          : el('span', { className: 'icon', 'aria-hidden': 'true' }, w.name.slice(0, 1).toUpperCase())
        const err = this.errors.get(w.rdns)
        const nameLine = el('div', { className: 'name' }, w.name)
        if (w.rdns === last) nameLine.append(el('span', { className: 'tag' }, L.lastUsed))
        const row = el('button', {
          className: 'row',
          'aria-label': `${w.name}, ${L.kind[w.kind]}`,
          'aria-busy': String(this.busy === w.rdns),
          onclick: () => { void this.pick(w) }
        }, icon, el('div', {}, nameLine, el('div', { className: 'meta' }, this.busy === w.rdns ? L.connecting : L.kind[w.kind])), el('span', { className: 'chev', 'aria-hidden': 'true' }, '›'))
        if (err != null) row.append(el('span', { className: 'err', role: 'alert' }, err))
        return el('li', {}, row)
      })))
    }

    const footer = el('footer', {}, el('button', { onclick: () => { void this.refresh() }, disabled: this.searching }, this.searching ? L.searching : L.refresh))
    if (this.options.helpUrl != null) footer.append(el('a', { href: this.options.helpUrl, target: '_blank', rel: 'noopener' }, `${L.help} ↗`))

    const panel = el('div', { className: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title' }, header, origin, ...body, footer)
    const scrim = el('div', { className: 'scrim', onclick: () => this.close() })
    this.root.replaceChildren(el('style', {}, STYLE), scrim, panel)
  }
}

if (typeof customElements !== 'undefined' && customElements.get('brc100-wallet-chooser') == null) {
  customElements.define('brc100-wallet-chooser', BRC100WalletChooser)
}

/**
 * Connect a wallet the standard way: reuse the one the user picked on this site if it's still
 * there, otherwise show the chooser (BRC draft §4, rules 4–5).
 */
export async function connectWallet (options: ChooserOptions = {}): Promise<ConnectedWallet> {
  const chooser = new BRC100WalletChooser()
  chooser.options = options
  const key = options.rememberKey === undefined ? 'brc100.wallet' : options.rememberKey
  const lastWallet = rememberedWallet(key)
  const last = lastWallet?.rdns ?? null
  // Nothing to reconnect to and no in-app host to find: show the panel at once, searching.
  if (last == null && !inFrame()) return await chooser.open()
  const found = await discoverWallets(options)

  const lone = found.length === 1 && found[0].kind === 'in-app' ? found[0] : null
  const again = found.find(w => w.rdns === last) ?? lone
  if (again != null) {
    try { return await identify(again) } catch { /* locked or refused: let the user choose */ }
  }
  const missing = lastWallet != null && !found.some(w => w.rdns === lastWallet.rdns) ? lastWallet.name : null
  return await chooser.open(missing != null ? (options.labels?.gone ?? LABELS.gone)(missing) : null)
}

/** Always show the panel (for a "Switch wallet" button). */
export async function switchWallet (options: ChooserOptions = {}): Promise<ConnectedWallet> {
  const chooser = new BRC100WalletChooser()
  chooser.options = options
  return await chooser.open()
}

declare global {
  interface HTMLElementTagNameMap { 'brc100-wallet-chooser': BRC100WalletChooser }
}
