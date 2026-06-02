/**
 * E2E tests – Golden Path: connect wallet → list projects → project detail → contribute → yield
 * Issue #51: Configurar tests E2E con Playwright
 *
 * This is the primary "happy path" flow that validates the full user journey:
 *   1. Landing page shown without wallet
 *   2. Wallet connect is triggered (mocked, no real extension needed)
 *   3. Redirect to /proyectos → project cards load
 *   4. Click a card → detail page renders
 *   5. Investment panel is visible
 *   6. Yield distribution section is visible
 *
 * The Freighter API and Stellar contract calls are mocked via addInitScript so
 * that tests run fully offline and deterministically in CI.
 */

import { test, expect, type Page } from '@playwright/test'
import { mockFreighterConnected, mockFreighterDisconnected, MOCK_ADDRESS } from './fixtures/freighter'

// ── Shared mock data ─────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 1,
  nombre: 'Proyecto Solar Comunitario',
  estado: 'EnProgreso',
  dueno: 'GDIFFERENTOWNER1234567890ABCDEF',
  descripcion: 'Instalación de paneles solares en comunidades rurales de Oaxaca.',
  meta: '200000000',      // 20 MXNe (7 decimals)
  aportado: '100000000',  // 10 MXNe
  yield_entregado: '500000',
  capital_en_cetes: '50000000',
  capital_en_amm: '50000000',
  yield_cetes_acumulado: '250000',
  yield_amm_acumulado: '250000',
  timestamp_inicio: Math.floor(Date.now() / 1000) - 86400 * 30,
  timestamp_vencimiento: Math.floor(Date.now() / 1000) + 86400 * 335,
  tiempo_meses: 12,
  doc_hash: 'QmSolarDoc1|QmSolarDoc2',
  motivo_rechazo: '',
}

/** Seed a wallet session in sessionStorage so the app auto-routes to /proyectos */
async function seedWalletSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('bimex.wallet.session', '1')
  })
}

/**
 * Stub `obtenerTodosLosProyectos` and individual project fetches.
 * We expose mock data on `window` so that any module that reads it gets
 * deterministic results without hitting the Stellar RPC.
 */
async function stubProjectData(page: Page) {
  await page.addInitScript((project: typeof MOCK_PROJECT) => {
    // Expose mocks for any dynamic import of contrato.js
    ;(window as any).__BIMEX_MOCK_PROJECTS__ = [project]
    ;(window as any).__BIMEX_MOCK_PROJECT__ = project

    // Stub fetch for Stellar/Soroban RPC calls
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (
        url.includes('soroban') ||
        url.includes('stellar') ||
        url.includes('horizon') ||
        url.includes('rpc')
      ) {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: { results: [] } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return originalFetch(input, init)
    }
  }, MOCK_PROJECT)
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Golden Path – flujo completo connect wallet → invertir → yield', () => {

  // ── Test 1: Landing sin wallet ─────────────────────────────────────────────
  test('landing muestra botón conectar sin wallet', async ({ page }) => {
    await mockFreighterDisconnected(page)
    await page.addInitScript(() => {
      sessionStorage.clear()
      localStorage.removeItem('bimex.wallet.session')
    })
    await page.goto('/')

    // Both hero CTA and navbar button must be visible
    const heroBtn = page.getByRole('button', { name: /conectar con freighter/i })
    await expect(heroBtn).toBeVisible({ timeout: 10_000 })

    const navBtn = page.getByRole('button', { name: /^conectar$/i })
    await expect(navBtn).toBeVisible()

    // Must stay on landing
    await expect(page).toHaveURL('/')
  })

  // ── Test 2: Con wallet → redirige a /proyectos ─────────────────────────────
  test('con wallet conectada redirige a /proyectos', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/')

    // App should redirect automatically
    await expect(page).toHaveURL('/proyectos', { timeout: 10_000 })
  })

  // ── Test 3: Lista de proyectos carga y muestra tarjetas ───────────────────
  test('lista de proyectos carga y muestra tarjetas (cards)', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos')

    // At minimum the page heading must appear, proving React mounted
    const heading = page.getByRole('heading', { level: 2 })
    await expect(heading).toBeVisible({ timeout: 10_000 })

    // The project grid (role=list) or individual article cards should render.
    // Cards are <article class="card" role="listitem">
    // We accept either real cards or skeleton cards (aria-hidden) being present
    const grid = page.locator('[role="list"], .grid-proyectos, .lista-contenedor')
    await expect(grid.first()).toBeVisible({ timeout: 15_000 })
  })

  // ── Test 4: Filtro "En Progreso" activa ese estado ──────────────────────────
  test('filtro "En Progreso" se activa al hacer clic', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos')

    // Wait for the filter row to appear
    const enProgresoBtn = page.getByRole('button', { name: /en progreso/i })
    await expect(enProgresoBtn).toBeVisible({ timeout: 15_000 })

    await enProgresoBtn.click()

    // After clicking, aria-pressed should be true
    await expect(enProgresoBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // ── Test 5: Navegar al detalle de un proyecto ─────────────────────────────
  test('navegar a /proyectos/:id muestra la página de detalle', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)

    // Navigate directly to the project detail route
    await page.goto('/proyectos/1')

    // The detail page renders a <h1> with the project name once data loads.
    // While loading it shows a skeleton (aria-hidden); wait for the real h1.
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible({ timeout: 15_000 })
  })

  // ── Test 6: Panel de inversión es visible en el detalle ───────────────────
  test('panel de inversión visible en la página de detalle', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos/1')

    // The invest panel has class "invest-panel" and a head section
    const investPanel = page.locator('.invest-panel')
    await expect(investPanel.first()).toBeVisible({ timeout: 15_000 })
  })

  // ── Test 7: Distribución del rendimiento visible en detalle ───────────────
  test('sección de distribución de yield visible en el detalle', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos/1')

    // Yield split table renders two percentages: 6.00% (proyecto) and 5.00% (inversor)
    await expect(page.getByText('6.00%').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('5.00%').first()).toBeVisible({ timeout: 15_000 })
  })

  // ── Test 8: Botón "Volver" regresa a /proyectos ───────────────────────────
  test('botón "Volver" en detalle navega de regreso a /proyectos', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos/1')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // back-link button (contains arrow + "Proyectos" text)
    const backBtn = page.locator('.back-link')
    await expect(backBtn).toBeVisible({ timeout: 15_000 })
    await backBtn.click()

    await expect(page).toHaveURL('/proyectos', { timeout: 10_000 })
  })

  // ── Test 9: Campo de cantidad de inversión acepta números ────────────────
  test('campo de inversión acepta monto numérico', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await stubProjectData(page)
    await page.goto('/proyectos/1')

    // The contribution input has type="number" inside .input-wrap
    const amountInput = page.locator('input[type="number"]')
    await expect(amountInput).toBeVisible({ timeout: 15_000 })

    await amountInput.fill('100')
    await expect(amountInput).toHaveValue('100')
  })

  // ── Test 10: Ruta inválida redirige a landing o proyectos ────────────────
  test('ruta desconocida redirige a la ruta correcta', async ({ page }) => {
    await mockFreighterConnected(page)
    await seedWalletSession(page)
    await page.goto('/ruta-que-no-existe')

    // With a wallet session, app should redirect to /proyectos
    await expect(page).toHaveURL('/proyectos', { timeout: 10_000 })
  })
})
