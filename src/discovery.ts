/**
 * BRC-100 wallet discovery (BRC draft §2–§3). No UI here: returns every wallet on offer.
 */
import { HTTPWalletJSON, WalletClient, type WalletInterface } from '@bsv/sdk'

export type WalletKind = 'extension' | 'desktop' | 'in-app' | 'web' | 'mobile' | 'other'

export interface BRC100WalletInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
  kind: WalletKind
}

export interface BRC100WalletAnnouncement {
  info: BRC100WalletInfo
  wallet: WalletInterface
}

export interface DiscoveredWallet {
  rdns: string
  name: string
  /** data: URI or URL; null when the wallet gave none. Render with <img src>, never as markup. */
  icon: string | null
  kind: WalletKind
  wallet: WalletInterface
  /** How it was found: announced, or one of the fallbacks for wallets that don't announce yet. */
  source: 'announced' | 'xdm' | 'window.CWI' | 'http' | 'app'
}

export interface DiscoverOptions {
  /** Your app's host, sent to local HTTP wallets. Defaults to location.host. */
  originator?: string
  /** How long to collect announcements. Default 400 ms. */
  announceMs?: number
  /** Probe local HTTP wallets (localhost:3321 / :2121). Default: true, except on phones. */
  probeLocal?: boolean
  /** Extra wallets the app supplies (phone pairing, web wallets). */
  extra?: DiscoveredWallet[]
}

export const REQUEST_EVENT = 'brc100:requestWallet'
export const ANNOUNCE_EVENT = 'brc100:announceWallet'

const isPhone = (): boolean =>
  typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent)

/** Framed by another page, e.g. a wallet's in-app browser. */
export const inFrame = (): boolean => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> =>
  await Promise.race([p, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

/** "yours-wallet-5.0.2" → "Yours Wallet". */
export function nameFromVersion (version: string, fallback: string): string {
  const base = version.replace(/[-_ ]?v?\d[\d.]*.*$/, '')
  if (base === '') return fallback
  return base.split(/[-_ ]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

/** Collect announcements for `ms` after asking. Deduped by rdns, latest wins. */
export async function collectAnnouncements (ms = 400): Promise<BRC100WalletAnnouncement[]> {
  return await new Promise(resolve => {
    const found = new Map<string, BRC100WalletAnnouncement>()
    const on = (e: Event): void => {
      const d = (e as CustomEvent<BRC100WalletAnnouncement>).detail
      if (typeof d?.info?.rdns === 'string' && d.wallet != null) found.set(d.info.rdns, d)
    }
    window.addEventListener(ANNOUNCE_EVENT, on)
    window.dispatchEvent(new Event(REQUEST_EVENT))
    setTimeout(() => {
      window.removeEventListener(ANNOUNCE_EVENT, on)
      resolve([...found.values()])
    }, ms)
  })
}

async function probeHttp (originator: string, url: string, rdns: string, fallback: string): Promise<DiscoveredWallet | null> {
  try {
    const wallet = new HTTPWalletJSON(originator, url)
    const { version } = await withTimeout(wallet.getVersion({}), 1500)
    return { rdns, name: nameFromVersion(version, fallback), icon: null, kind: 'desktop', wallet, source: 'http' }
  } catch {
    return null
  }
}

/** Find every BRC-100 wallet available to this page. Never picks one. */
export async function discoverWallets (opts: DiscoverOptions = {}): Promise<DiscoveredWallet[]> {
  const originator = opts.originator ?? window.location.host
  const probeLocal = opts.probeLocal ?? !isPhone()

  // Run the slow probes alongside the announcement window.
  const local = probeLocal && !inFrame()
    ? Promise.all([
      probeHttp(originator, 'http://localhost:3321', 'local.json-api.3321', 'Desktop wallet'),
      probeHttp(originator, 'https://localhost:2121', 'local.secure-json-api.2121', 'Desktop wallet')
    ])
    : Promise.resolve([])

  const list: DiscoveredWallet[] = (await collectAnnouncements(opts.announceMs)).map(a => ({
    rdns: a.info.rdns,
    name: a.info.name,
    icon: a.info.icon ?? null,
    kind: a.info.kind ?? 'extension',
    wallet: a.wallet,
    source: 'announced'
  }))

  // Framed by a wallet's in-app browser: the host answers BRC-100 XDM.
  if (inFrame() && !list.some(w => w.kind === 'in-app')) {
    try {
      const host = new WalletClient('XDM', originator)
      const { version } = await withTimeout(host.getVersion({}), 2500)
      list.push({ rdns: 'legacy.xdm-host', name: nameFromVersion(version, 'This app'), icon: null, kind: 'in-app', wallet: host, source: 'xdm' })
    } catch { /* framed by something that isn't a wallet */ }
  }

  // A window.CWI nobody announced (wallets that predate this BRC).
  const cwi = (window as unknown as { CWI?: WalletInterface }).CWI
  if (cwi != null && !list.some(w => w.wallet === cwi)) {
    let name = 'Browser wallet'
    try {
      name = nameFromVersion((await withTimeout(cwi.getVersion({}), 1500)).version, name)
    } catch { /* locked or slow */ }
    list.push({ rdns: 'legacy.window-cwi', name, icon: null, kind: 'extension', wallet: cwi, source: 'window.CWI' })
  }

  for (const w of await local) if (w != null) list.push(w)
  for (const w of opts.extra ?? []) list.push({ ...w, source: 'app' })
  return list
}

/** Wallet side: announce now and on every request. Returns a function that stops announcing. */
export function announceWallet (info: Omit<BRC100WalletInfo, 'uuid'>, wallet: WalletInterface): () => void {
  const detail = Object.freeze({ info: Object.freeze({ ...info, uuid: crypto.randomUUID() }), wallet })
  const announce = (): void => { window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail })) }
  window.addEventListener(REQUEST_EVENT, announce)
  announce()
  return () => window.removeEventListener(REQUEST_EVENT, announce)
}
