import type { Machine } from '../types/database'
import { QUICK_CHAT_PLACEHOLDER_NAME } from './quickChat'

export function machineLabel(m: Machine): string {
  if (m.name === QUICK_CHAT_PLACEHOLDER_NAME || (!m.make.trim() && !m.model.trim())) {
    return 'Untitled session'
  }
  if (m.make.trim() && m.model.trim()) {
    const makeModel = `${m.make} ${m.model}`
    if (m.name && m.name !== makeModel && m.name !== m.model && m.name !== m.make) {
      return `${makeModel} (“${m.name}”)`
    }
    return makeModel
  }
  return m.name || 'Machine'
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
