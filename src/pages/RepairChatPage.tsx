import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { GusChatPanel } from '../components/GusChatPanel'

/**
 * Full-page repair chat (fleet / deep links). Dashboard quick-ask stays on /
 * with an embedded dock instead.
 */
export function RepairChatPage() {
  const { id: machineId } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const statePrefill = (location.state as { prefillMessage?: string } | null)?.prefillMessage ?? null
  // Keep prefill across the replace-state cleanup so GusChatPanel still sends it.
  const prefillRef = useRef<string | null>(statePrefill)
  if (statePrefill) prefillRef.current = statePrefill

  useEffect(() => {
    if (!statePrefill) return
    navigate(location.pathname, { replace: true, state: null })
  }, [statePrefill, location.pathname, navigate])

  if (!machineId) return <p className="text-steel-400">Missing machine.</p>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GusChatPanel
        machineId={machineId}
        initialMessage={prefillRef.current}
        variant="page"
        onNewChat={() => navigate('/')}
        onInitialMessageConsumed={() => {
          prefillRef.current = null
        }}
      />
    </div>
  )
}
