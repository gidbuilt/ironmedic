import { supabase } from './supabase'
import type { Diagnosis } from '../types/database'

export async function listDiagnoses(machineId: string): Promise<Diagnosis[]> {
  const { data, error } = await supabase
    .from('diagnoses')
    .select('*')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Diagnosis[]
}

export const FOLLOWUP_THRESHOLD_MS = 48 * 60 * 60 * 1000

export function isOverdueForFollowup(diagnosis: Diagnosis): boolean {
  if (diagnosis.outcome !== 'pending') return false
  return Date.now() - new Date(diagnosis.created_at).getTime() > FOLLOWUP_THRESHOLD_MS
}
