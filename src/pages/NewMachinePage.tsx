import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createMachine } from '../lib/machines'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function NewMachinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [hours, setHours] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      const machine = await createMachine(user.id, {
        name,
        make,
        model,
        serial_number: serialNumber || null,
        hours: hours ? Number(hours) : null,
      })
      navigate(`/machines/${machine.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5 pb-10">
      <div className="space-y-1.5">
        <Link to="/machines" className="im-pill !px-2.5">
          ← Fleet
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">
          New equipment record
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Add a machine</h1>
        <p className="text-[15px] text-steel-400">Nickname plus make and model is enough to start.</p>
      </div>

      <Card accent="tech" className="p-6 sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nickname"
            placeholder='e.g. "The Old Deere"'
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Input
              label="Make"
              placeholder="John Deere"
              required
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />
            <Input
              label="Model"
              placeholder="5075E"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          <Input
            label="Serial number (optional)"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <Input
            label="Hours (optional)"
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving…' : 'Save machine'}
            </Button>
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
