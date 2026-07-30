#!/usr/bin/env node
/**
 * One-shot deploy of IronMedic to Supabase:
 *   1. Link project (if needed)
 *   2. Push database migrations
 *   3. Deploy Edge Functions (gus-chat, gus-speak)
 *   4. Build the Vite SPA for Storage hosting
 *   5. Upload dist/ to the public `website` bucket
 *
 * Prerequisites:
 *   - Supabase CLI: npx supabase (via devDependencies or global)
 *   - SUPABASE_ACCESS_TOKEN — from https://supabase.com/dashboard/account/tokens
 *   - SUPABASE_PROJECT_REF — project Settings → General → Reference ID
 *   - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY — for the frontend build (.env or env)
 *
 * Edge Function secrets (set once in dashboard or via CLI):
 *   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   npx supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=canadacentral
 *   npx supabase secrets set ALLOWED_ORIGIN=https://YOUR_REF.supabase.co
 *
 * Usage:
 *   node scripts/deploy-supabase.mjs
 *   node scripts/deploy-supabase.mjs --skip-website   # backend only
 *   node scripts/deploy-supabase.mjs --skip-db        # functions + website only
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(path.join(rootDir, '.env'))

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const args = process.argv.slice(2)
const skipWebsite = args.includes('--skip-website')
const skipDb = args.includes('--skip-db')

if (!PROJECT_REF) {
  console.error('Missing SUPABASE_PROJECT_REF (your project Reference ID from Supabase dashboard).')
  process.exit(1)
}
if (!ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Run `npx supabase login` or set the token env var.')
  process.exit(1)
}

function run(cmd, cmdArgs, { env = {} } = {}) {
  const label = [cmd, ...cmdArgs].join(' ')
  console.log(`\n→ ${label}`)
  const result = spawnSync(cmd, cmdArgs, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    console.error(`\nFailed: ${label}`)
    process.exit(result.status ?? 1)
  }
}

// Link writes supabase/.temp/project-ref — required for db push / storage cp --linked
run('npx', ['supabase', 'link', '--project-ref', PROJECT_REF, '--yes'])

if (!skipDb) {
  run('npx', ['supabase', 'db', 'push', '--yes'])
}

run('npx', ['supabase', 'functions', 'deploy', 'gus-chat', '--yes'])
run('npx', ['supabase', 'functions', 'deploy', 'gus-speak', '--yes'])

if (!skipWebsite) {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — required to build the frontend.')
    process.exit(1)
  }

  run('npm', ['run', 'build'], {
    env: {
      VITE_DEPLOY_TARGET: 'supabase-storage',
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: ANON_KEY,
    },
  })

  run('npx', [
    'supabase',
    'storage',
    'cp',
    '--linked',
    '--recursive',
    '--yes',
    path.join(rootDir, 'dist'),
    'ss:///website',
  ])
}

const ref = PROJECT_REF
const websiteUrl = `https://${ref}.supabase.co/storage/v1/object/public/website/index.html`
const functionsBase = `https://${ref}.supabase.co/functions/v1`

console.log('\n✓ IronMedic deployed to Supabase\n')
console.log(`  App (open on phone):  ${websiteUrl}`)
console.log(`  gus-chat:             ${functionsBase}/gus-chat`)
console.log(`  gus-speak:            ${functionsBase}/gus-speak`)
console.log(`  Dashboard:            https://supabase.com/dashboard/project/${ref}`)
console.log('\nAuth redirect: add the app URL above to Authentication → URL Configuration → Redirect URLs.')
console.log('CORS: set ALLOWED_ORIGIN to your app URL (or * for testing).\n')
