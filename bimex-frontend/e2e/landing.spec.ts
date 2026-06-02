/**
 * E2E tests – Landing page (sin wallet conectada)
 * Issue #51: Configurar tests E2E con Playwright
 *
 * These tests verify the landing experience for a new visitor who has not yet
 * connected their Freighter wallet. The Freighter mock is set to "disconnected"
 * so the page behaves as if the extension is absent.
 */

import { test, expect } from '@playwright/test'
import { mockFreighterDisconnected } from './fixtures/freighter'

test.describe('Landing – sin wallet', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure no wallet session is persisted from previous runs
    await page.addInitScript(() => {
      sessionStorage.clear()
      localStorage.removeItem('bimex.wallet.session')
    })
    await mockFreighterDisconnected(page)
    await page.goto('/')
  })

  // ── 1. Connect-wallet CTA is prominently visible ────────────────────────────
  test('muestra el botón "Conectar con Freighter" en el hero', async ({ page }) => {
    // The landing hero renders a large CTA button
    const heroBtn = page.getByRole('button', { name: /conectar con freighter/i })
    await expect(heroBtn).toBeVisible()
  })

  // ── 2. Navbar also shows a compact connect button ───────────────────────────
  test('muestra el botón "Conectar" en la navbar del landing', async ({ page }) => {
    const navBtn = page.getByRole('button', { name: /^conectar$/i })
    await expect(navBtn).toBeVisible()
  })

  // ── 3. Hero headline is rendered ────────────────────────────────────────────
  test('renderiza el h1 principal del hero', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    // Should contain the brand tagline
    await expect(h1).toContainText(/invierte/i)
  })

  // ── 4. Yield card is visible ─────────────────────────────────────────────────
  test('muestra la tarjeta de distribución del rendimiento', async ({ page }) => {
    await expect(page.getByText('Distribución del rendimiento')).toBeVisible()
    await expect(page.getByText('13.45%')).toBeVisible()
  })

  // ── 5. "How it works" steps ──────────────────────────────────────────────────
  test('muestra los pasos de cómo funciona Bimex', async ({ page }) => {
    await expect(page.getByText('Conecta tu wallet')).toBeVisible()
    await expect(page.getByText(/deposita mxne/i)).toBeVisible()
  })

  // ── 6. Transparencia link is present ─────────────────────────────────────────
  test('muestra el enlace de Transparencia', async ({ page }) => {
    const transparenciaBtn = page.getByRole('button', { name: /transparencia/i })
    await expect(transparenciaBtn).toBeVisible()
  })

  // ── 7. Page does NOT redirect to /proyectos without wallet ───────────────────
  test('permanece en "/" sin redirigir a /proyectos sin wallet', async ({ page }) => {
    await expect(page).toHaveURL('/')
  })

  // ── 8. Page title is set ─────────────────────────────────────────────────────
  test('el título de la página está configurado', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/)
  })
})
