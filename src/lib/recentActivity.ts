import { supabase } from './supabase'
import { listMachines } from './machines'
import type { Machine } from '../types/database'

export type RecentSession = {
  machine: Machine
  lastMessage: string | null
  lastActiveAt: string
  hasChat: boolean
}

function previewText(content: string, max = 72): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

/** Machines and chats sorted by most recent conversation activity. */
export async function listRecentSessions(limit = 6): Promise<RecentSession[]> {
  const machines = await listMachines()
  if (machines.length === 0) return []

  const machineIds = machines.map((m) => m.id)
  const { data: convos, error } = await supabase
    .from('conversations')
    .select('machine_id, content, created_at')
    .in('machine_id', machineIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const latestByMachine = new Map<string, { content: string; created_at: string }>()
  for (const row of convos ?? []) {
    if (!latestByMachine.has(row.machine_id)) {
      latestByMachine.set(row.machine_id, { content: row.content, created_at: row.created_at })
    }
  }

  const sessions: RecentSession[] = machines.map((machine) => {
    const latest = latestByMachine.get(machine.id)
    return {
      machine,
      lastMessage: latest ? previewText(latest.content) : null,
      lastActiveAt: latest?.created_at ?? machine.updated_at ?? machine.created_at,
      hasChat: Boolean(latest),
    }
  })

  sessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
  return sessions.slice(0, limit)
}
