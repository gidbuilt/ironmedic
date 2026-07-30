import { supabase } from './supabase'
import { FOLLOWUP_THRESHOLD_MS } from './diagnoses'

const NOTIFIED_KEY = 'ironmedic:notified-diagnoses'

function getNotifiedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function markNotified(id: string) {
  const ids = getNotifiedIds()
  ids.add(id)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]))
}

/**
 * Best-effort follow-up reminder using the browser Notification API. This is
 * NOT true push — it only fires while a tab is open to check, since real
 * background push requires a service worker + VAPID keys + a push
 * subscription table, which is out of scope for the web MVP (see README).
 * It still meaningfully improves on "wait for the user to remember to open
 * the app," which is the actual failure mode this guards against.
 */
export async function checkPendingFollowups(userId: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const { data: diagnoses } = await supabase
    .from('diagnoses')
    .select('id, summary, outcome, created_at, machine_id, machines(name)')
    .eq('user_id', userId)
    .eq('outcome', 'pending')

  if (!diagnoses) return
  const notified = getNotifiedIds()

  interface PendingDiagnosisRow {
    id: string
    summary: string
    outcome: 'pending'
    created_at: string
    machine_id: string
    machines: { name: string } | null
  }

  for (const d of diagnoses as unknown as PendingDiagnosisRow[]) {
    if (notified.has(d.id)) continue
    if (Date.now() - new Date(d.created_at).getTime() <= FOLLOWUP_THRESHOLD_MS) continue
    const machineName = d.machines?.name ?? 'your machine'
    new Notification('IronMedic — did that fix it?', {
      body: `${machineName}: "${d.summary}" — let Gus know if the repair worked.`,
      tag: `diagnosis-${d.id}`,
    })
    markNotified(d.id)
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}
