/**
 * Freighter wallet mock fixtures for Playwright E2E tests.
 * Issue #51: Configurar tests E2E con Playwright
 *
 * These helpers inject a mock `window.freighter` object (and the individual
 * named exports used by @stellar/freighter-api) into the page context so that
 * tests can simulate a connected Stellar Testnet wallet without requiring the
 * actual browser extension to be installed.
 *
 * Usage:
 *   import { mockFreighterConnected, mockFreighterDisconnected } from './fixtures/freighter'
 *   await page.addInitScript(mockFreighterConnected)
 */

import type { Page } from '@playwright/test'

export const MOCK_ADDRESS = 'GCTEST1234MOCKADDRESSBIMEXSTELLARTESTNETABCDE56789XYZ'
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'

/**
 * Injects a fully-connected Freighter mock.
 * The app's ConectarWallet component calls the individual named exports
 * (`isConnected`, `isAllowed`, `requestAccess`, `getAddress`, `getNetwork`)
 * that @stellar/freighter-api re-exports from `window.freighter`.
 */
export async function mockFreighterConnected(page: Page): Promise<void> {
  await page.addInitScript(
    ({ address, passphrase }: { address: string; passphrase: string }) => {
      // The raw freighter extension object
      const freighter = {
        isConnected: async () => ({ isConnected: true }),
        isAllowed: async () => ({ isAllowed: true }),
        getAddress: async () => ({ address }),
        getNetwork: async () => ({
          network: 'TESTNET',
          networkPassphrase: passphrase,
        }),
        requestAccess: async () => ({ address }),
        signTransaction: async (xdr: string) => ({ signedTxXdr: xdr }),
      }

      // Expose on window so the SDK wrappers can find it
      ;(window as any).freighter = freighter

      // @stellar/freighter-api resolves each call through these helpers.
      // We patch them so the app gets consistent mocked responses.
      ;(window as any).__freighterApi = {
        isConnected: freighter.isConnected,
        isAllowed: freighter.isAllowed,
        getAddress: freighter.getAddress,
        getNetwork: freighter.getNetwork,
        requestAccess: freighter.requestAccess,
        signTransaction: freighter.signTransaction,
        setAllowed: async () => ({ isAllowed: false }),
      }
    },
    { address: MOCK_ADDRESS, passphrase: TESTNET_PASSPHRASE }
  )
}

/**
 * Injects a Freighter mock that reports the extension as NOT installed /
 * not connected. Useful for testing the landing page in its default state.
 */
export async function mockFreighterDisconnected(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as any).freighter = undefined
    ;(window as any).__freighterApi = {
      isConnected: async () => ({ isConnected: false }),
      isAllowed: async () => ({ isAllowed: false }),
      getAddress: async () => ({ address: '' }),
      getNetwork: async () => ({ network: '', networkPassphrase: '' }),
      requestAccess: async () => { throw new Error('Freighter not installed') },
      setAllowed: async () => ({ isAllowed: false }),
    }
  })
}
