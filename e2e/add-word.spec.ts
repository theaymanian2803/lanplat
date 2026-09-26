import { test, expect } from '@playwright/test'
import { createClient } from '@libsql/client'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(): { url: string; token: string } {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) throw new Error('.env not found')
  const raw = readFileSync(envPath, 'utf-8')
  const vars: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (m) vars[m[1]] = m[2]
  }
  const url = vars.VITE_TURSO_DATABASE_URL
  const token = vars.VITE_TURSO_AUTH_TOKEN
  if (!url || !token) throw new Error('Missing Turso env vars')
  return { url, token }
}

const env = loadEnv()
const db = createClient({ url: env.url, authToken: env.token })

const runId = Date.now()
const TEST_VIDEO_ID = `e2e-video-${runId}`
const TEST_WORD = `e2etestword${runId}`
const TEST_TRANSLATION = `e2e test translation ${runId}`

test.describe.configure({ mode: 'serial' })

test('add word from Study Room appears in Vocab Bank', async ({ page }) => {
  await db.execute({
    sql: 'INSERT INTO videos (id, user_id, youtube_url, title, language, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [TEST_VIDEO_ID, 'local-user', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'E2E Test Video', 'Danish', new Date().toISOString()],
  })

  await page.addInitScript(() => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    // The welcome tour redirects a first-visit deep link to /dashboard
    // (OnboardingDialog navigates away whenever it is open and the path is
    // not /dashboard), so the Study Room would never render without this.
    localStorage.setItem('lingovault_onboarded', '1')
  })

  try {
    await page.goto(`/video/${TEST_VIDEO_ID}`)

    await page.getByTitle('Add Word').waitFor({ state: 'visible', timeout: 30_000 })
    await page.getByTitle('Add Word').click()

    // AddWordPanel renders as an <aside>, not a dialog, so scope by its heading.
    const panel = page.locator('aside').filter({ hasText: 'Add Vocabulary Word' })
    await expect(panel).toBeVisible()

    await panel.getByPlaceholder('e.g. hund').fill(TEST_WORD)
    await panel.getByPlaceholder('e.g. dog').fill(TEST_TRANSLATION)

    await panel.getByRole('button', { name: 'Save Word', exact: true }).click()

    await expect(page.getByText('Word saved to Vocab Bank!')).toBeVisible({ timeout: 15_000 })
    // The panel stays open and clears itself so the next word can be typed
    // straight away; it is only closed by its own X button.
    await expect(panel.getByPlaceholder('e.g. hund')).toHaveValue('')
    await expect(panel.getByPlaceholder('e.g. dog')).toHaveValue('')

    await page.goto('/vocab')
    const row = page.locator('tr').filter({ hasText: TEST_WORD })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText(TEST_TRANSLATION)
    await expect(row).toContainText('Danish')

    await page.goto(`/video/${TEST_VIDEO_ID}`)
    await page.getByTitle('Add Note (Ctrl+Enter)').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTitle('Add Note (Ctrl+Enter)').click()
    const noteAside = page.getByPlaceholder('Type your note…')
    await expect(noteAside).toBeVisible()
    await noteAside.fill('e2e test note')
    await page.getByRole('button', { name: 'Save Note' }).click()
    await expect(page.getByText('Note added')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('e2e test note')).toBeVisible()
  } finally {
    await db.execute({ sql: 'DELETE FROM vocabulary WHERE word = ?', args: [TEST_WORD] }).catch(() => {})
    await db.execute({ sql: 'DELETE FROM notes WHERE content = ?', args: ['e2e test note'] }).catch(() => {})
    await db.execute({ sql: 'DELETE FROM videos WHERE id = ?', args: [TEST_VIDEO_ID] }).catch(() => {})
  }
})