#!/usr/bin/env node
/**
 * Fast dev-loop for tuning Gus's prompt/behavior without going through the
 * browser or a full signup/login smoke test every time.
 *
 * Logs in as a persistent local test user, ensures a scratch machine exists,
 * and (by default) wipes that machine's conversation history first so every
 * run tests a clean "first message" — the exact scenario prompt tweaks like
 * brevity are aimed at. Prints Gus's streamed reply straight to the terminal.
 *
 * Usage:
 *   node scripts/ask-gus.mjs "I have a John Deere 2154G mistracking left, forward and reverse."
 *   node scripts/ask-gus.mjs --continue "It's been doing it for about a week."
 *   node scripts/ask-gus.mjs --machine "310L excavator" "some other symptom"
 *
 * Config (env or .env.devtest, gitignored):
 *   DEVTEST_EMAIL, DEVTEST_PASSWORD — a confirmed Supabase auth user used
 *   only for this local loop. Never used against production data.
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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
loadEnvFile(path.join(rootDir, '.env.devtest'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const TEST_EMAIL = process.env.DEVTEST_EMAIL ?? 'devloop@ironmedic.test'
const TEST_PASSWORD = process.env.DEVTEST_PASSWORD ?? 'DevLoop123!'

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check .env')
  process.exit(1)
}

const args = process.argv.slice(2)
const continueThread = args.includes('--continue')
let machineName = 'Dev Loop Scratch Machine'
const machineFlagIdx = args.indexOf('--machine')
if (machineFlagIdx !== -1) {
  machineName = args[machineFlagIdx + 1]
  args.splice(machineFlagIdx, 2)
}
const message = args.filter((a) => a !== '--continue').join(' ').trim()
if (!message) {
  console.error('Usage: node scripts/ask-gus.mjs [--continue] [--machine "name"] "<message>"')
  process.exit(1)
}

async function rest(pathAndQuery, { method = 'GET', token, body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`REST ${method} ${pathAndQuery} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}\nIs DEVTEST_EMAIL/DEVTEST_PASSWORD set up? See .env.devtest`)
  }
  const data = await res.json()
  return { accessToken: data.access_token, userId: data.user.id }
}

async function ensureMachine(token, userId) {
  const cacheKey = `DEVTEST_MACHINE_ID_${machineName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
  if (process.env[cacheKey]) {
    const existing = await rest(`machines?id=eq.${process.env[cacheKey]}&select=id`, { token })
    if (existing.length) return existing[0].id
  }
  const [created] = await rest('machines', {
    method: 'POST',
    token,
    prefer: 'return=representation',
    body: { user_id: userId, name: machineName, make: 'John Deere', model: '2154G' },
  })
  appendFileSync(path.join(rootDir, '.env.devtest'), `\n${cacheKey}=${created.id}\n`)
  console.log(`(created scratch machine ${created.id}, cached in .env.devtest)`)
  return created.id
}

async function resetMachine(token, machineId) {
  await Promise.all(
    ['conversations', 'diagnoses', 'repairs'].map((table) => rest(`${table}?machine_id=eq.${machineId}`, { method: 'DELETE', token })),
  )
}

async function askGus(token, machineId, text) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gus-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    body: JSON.stringify({ machine_id: machineId, message: text }),
  })
  if (!res.ok || !res.body) {
    console.error(`gus-chat failed: ${res.status} ${await res.text().catch(() => '')}`)
    process.exit(1)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      const jsonStr = dataLine.slice(5).trim()
      if (!jsonStr) continue
      let event
      try {
        event = JSON.parse(jsonStr)
      } catch {
        continue
      }
      if (event.type === 'text') {
        process.stdout.write(event.text)
        fullText += event.text
      } else if (event.type === 'status') {
        process.stdout.write(`\n[${event.status}]\n`)
      } else if (event.type === 'done') {
        process.stdout.write('\n')
        console.log(`\n--- stage: ${event.stage ?? 'n/a'} | words: ${fullText.trim().split(/\s+/).length} ---`)
        if (event.differential) console.log('differential:', JSON.stringify(event.differential, null, 2))
        if (event.diagnosis) {
          console.log('diagnosis:', JSON.stringify(event.diagnosis, null, 2))
          if (!Array.isArray(event.diagnosis.repair_steps) || event.diagnosis.repair_steps.length === 0) {
            console.log('*** WARNING: repair_steps missing/empty ***')
          }
          if (!Array.isArray(event.diagnosis.verification_steps) || event.diagnosis.verification_steps.length === 0) {
            console.log('*** WARNING: verification_steps missing/empty ***')
          }
        }
      } else if (event.type === 'error') {
        console.error('\n[error]', event.message)
      }
    }
  }
}

const { accessToken, userId } = await login()
const machineId = await ensureMachine(accessToken, userId)
if (!continueThread) {
  await resetMachine(accessToken, machineId)
  console.log(`(reset conversation history for machine ${machineId} — testing as a fresh first message)\n`)
} else {
  console.log(`(continuing existing conversation on machine ${machineId})\n`)
}
await askGus(accessToken, machineId, message)
