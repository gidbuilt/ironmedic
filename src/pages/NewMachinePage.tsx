import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="mx-auto max-w-lg">
      <p className="font-mono text-[11px] font-semibold tracking-widest text-steel-500 uppercase">New equipment record</p>
      <h1 className="mb-6 text-2xl font-semibold text-steel-50">Add a machine</h1>
      <Card accent="tech" className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nickname"
            placeholder='e.g. "The Old Deere"'
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
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
          <div className="mt-2 flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save machine'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
