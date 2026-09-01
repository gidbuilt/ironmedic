import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { GusChatPanel } from '../components/GusChatPanel'
import { useAuth } from '../context/AuthContext'
import { createQuickChatMachine } from '../lib/quickChat'

/**
 * Full-page repair chat (fleet / deep links). Dashboard quick-ask stays on /
 * with an embedded dock instead.
 */
export function RepairChatPage() {
  const { id: machineId } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isSubscribed } = useAuth()
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
    <div className="flex min-h-0 flex-1 flex-col">
      <GusChatPanel
        machineId={machineId}
        initialMessage={prefillRef.current}
        variant="page"
        onNewChat={() => {
          if (!user) {
            navigate('/')
            return
          }
          if (!isSubscribed) {
            navigate('/pricing')
            return
          }
          void createQuickChatMachine(user.id)
            .then((machine) => navigate(`/machines/${machine.id}/repair`))
            .catch((err) =>
              alert(err instanceof Error ? err.message : 'Could not start a new chat.'),
            )
        }}
        onInitialMessageConsumed={() => {
          prefillRef.current = null
        }}
      />
    </div>
  )
}
