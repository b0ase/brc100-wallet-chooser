// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { ProtoWallet, PrivateKey } from '@bsv/sdk'
import { announceWallet, collectAnnouncements, discoverWallets, nameFromVersion } from './discovery'
import { orderWallets } from './element'

const wallet = () => new ProtoWallet(PrivateKey.fromRandom())

describe('discovery', () => {
  it('collects announcements and dedupes by rdns', async () => {
    const w = wallet()
    const stopA = announceWallet({ name: 'A', icon: '', rdns: 'x.a', kind: 'extension' }, w)
    const stopA2 = announceWallet({ name: 'A again', icon: '', rdns: 'x.a', kind: 'extension' }, w)
    const stopB = announceWallet({ name: 'B', icon: '', rdns: 'x.b', kind: 'desktop' }, wallet())
    const found = await collectAnnouncements(20)
    expect(found.map(f => f.info.rdns).sort()).toEqual(['x.a', 'x.b'])
    stopA(); stopA2(); stopB()
    expect(await collectAnnouncements(20)).toEqual([])
  })

  it('lists an unannounced window.CWI once, named from its version', async () => {
    const cwi = Object.assign(wallet(), { getVersion: async () => ({ version: 'yours-wallet-5.0.2' }) })
    ;(window as any).CWI = cwi
    const list = await discoverWallets({ announceMs: 20, probeLocal: false })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Yours Wallet', rdns: 'legacy.window-cwi', source: 'window.CWI' })

    // Announced by its owner: shown once, under the announced name.
    const stop = announceWallet({ name: 'Yours', icon: '', rdns: 'org.yours', kind: 'extension' }, cwi)
    const again = await discoverWallets({ announceMs: 20, probeLocal: false })
    expect(again.map(w => w.name)).toEqual(['Yours'])
    stop(); delete (window as any).CWI
  })

  it('names wallets from version strings', () => {
    expect(nameFromVersion('bsv-desktop-1.2.3', 'x')).toBe('Bsv Desktop')
    expect(nameFromVersion('1.0.0', 'Desktop wallet')).toBe('Desktop wallet')
  })
})

describe('ordering', () => {
  it('puts last used first, then kind group, then name', () => {
    const mk = (rdns: string, name: string, kind: any) => ({ rdns, name, kind, icon: null, wallet: wallet(), source: 'announced' as const })
    const list = [mk('d', 'Zed', 'desktop'), mk('b', 'Bee', 'extension'), mk('a', 'Ay', 'extension'), mk('c', 'Cee', 'desktop')]
    expect(orderWallets(list, null).map(w => w.rdns)).toEqual(['a', 'b', 'c', 'd'])
    expect(orderWallets(list, 'd').map(w => w.rdns)).toEqual(['d', 'a', 'b', 'c'])
  })
})
