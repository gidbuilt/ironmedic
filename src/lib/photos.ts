import { supabase } from './supabase'

/** Uploads a photo to the private `photos` bucket under the RLS-required
 * `{user_id}/{machine_id}/...` path convention and returns the storage path
 * (not a public URL — the bucket is private; the Edge Function reads it
 * back with the user's own credentials when building the Claude request). */
export async function uploadPhoto(userId: string, machineId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${machineId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function getPhotoPreviewUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
