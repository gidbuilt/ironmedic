import { supabase } from './supabase'
import { randomId } from './id'

const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

/**
 * iPhone camera shots are often HEIC (or have an empty MIME type). Claude and
 * our upload path are most reliable with JPEG — re-encode when needed.
 */
export async function normalizePhotoForUpload(file: File): Promise<File> {
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  const isHeic =
    type.includes('heic') ||
    type.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  const alreadyOk = type === 'image/jpeg' || type === 'image/png' || type === 'image/webp'

  if (alreadyOk) return file

  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob) throw new Error('encode failed')

    const base = file.name.replace(/\.(heic|heif|jpeg|jpg|png|webp)$/i, '') || `photo-${Date.now()}`
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    if (isHeic) {
      throw new Error(
        'This iPhone photo is HEIC and couldn’t be converted. In Settings → Camera → Formats, choose “Most Compatible”, then snap again.',
      )
    }
    // Empty / odd MIME from some cameras — force jpeg label if the bytes are likely an image.
    if (!type || type === 'application/octet-stream') {
      const base = file.name.includes('.') ? file.name : `${file.name || 'photo'}.jpg`
      return new File([file], base.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    }
    if (!ALLOWED_UPLOAD_TYPES.has(type)) {
      throw new Error(`Unsupported photo type (${type || 'unknown'}). Try a JPEG or PNG.`)
    }
    return file
  }
}

/** Uploads a photo to the private `photos` bucket; returns the storage path. */
export async function uploadPhoto(userId: string, machineId: string, file: File): Promise<string> {
  const normalized = await normalizePhotoForUpload(file)
  const ext = normalized.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${machineId}/${Date.now()}-${randomId()}.${ext}`
  const contentType = normalized.type || 'image/jpeg'

  const { error } = await supabase.storage.from('photos').upload(path, normalized, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(error.message || 'Photo upload failed')
  return path
}

export async function getPhotoPreviewUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
