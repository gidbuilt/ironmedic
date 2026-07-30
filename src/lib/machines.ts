import { supabase } from './supabase'
import type { Machine } from '../types/database'

export interface MachineInput {
  name: string
  make: string
  model: string
  serial_number?: string | null
  hours?: number | null
}

export async function listMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Machine[]
}

export async function getMachine(id: string): Promise<Machine | null> {
  const { data, error } = await supabase.from('machines').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Machine | null
}

export async function createMachine(userId: string, input: MachineInput): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Machine
}

export async function updateMachine(id: string, input: Partial<MachineInput>): Promise<Machine> {
  const { data, error } = await supabase
    .from('machines')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Machine
}

export async function deleteMachine(id: string): Promise<void> {
  const { error } = await supabase.from('machines').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
