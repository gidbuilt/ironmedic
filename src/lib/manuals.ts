import { supabase } from './supabase'
import type { Manual, ManualExtractionStatus } from '../types/database'

const MIN_CHARS_FOR_REAL_TEXT_LAYER = 200

// pdf.js (~1.2MB with its worker) is only needed on the rare "upload a
// manual" action, so it's dynamically imported rather than bundled into the
// main chunk every user downloads just to view their machine list.
async function loadPdfJs() {
  const [pdfjsLib, workerUrlModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default
  return pdfjsLib
}

/**
 * Extracts text client-side (free, no API cost) — knowledge layer 1's whole
 * point is that this never touches a server. Returns a status distinguishing
 * a real failure from the well-known "this is a scanned image, not a text
 * PDF" case (Pre-Flight Risk Review #2) so the UI can explain what happened
 * instead of silently uploading a manual Gus can never actually read.
 */
export async function extractPdfText(file: File): Promise<{ text: string; status: ManualExtractionStatus }> {
  try {
    const pdfjsLib = await loadPdfJs()
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const pageTexts: string[] = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      pageTexts.push(pageText)
    }
    const text = pageTexts.join('\n\n')
    if (text.trim().length < MIN_CHARS_FOR_REAL_TEXT_LAYER) {
      return { text: '', status: 'empty_scanned_pdf' }
    }
    return { text, status: 'ok' }
  } catch (err) {
    console.error('PDF extraction failed', err)
    return { text: '', status: 'error' }
  }
}

export async function uploadManual(userId: string, machineId: string, file: File): Promise<Manual> {
  const { text, status } = await extractPdfText(file)

  const path = `${userId}/${machineId}/${Date.now()}-${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage.from('manuals').upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('manuals')
    .insert({
      machine_id: machineId,
      user_id: userId,
      filename: file.name,
      storage_path: path,
      extracted_text: text || null,
      extraction_status: status,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Manual
}

export async function listManuals(machineId: string): Promise<Manual[]> {
  const { data, error } = await supabase
    .from('manuals')
    .select('*')
    .eq('machine_id', machineId)
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Manual[]
}

export async function deleteManual(manual: Manual): Promise<void> {
  await supabase.storage.from('manuals').remove([manual.storage_path])
  const { error } = await supabase.from('manuals').delete().eq('id', manual.id)
  if (error) throw new Error(error.message)
}
