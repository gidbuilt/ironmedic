import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'

/**
 * Synthesizes Gus's speech server-side with Azure Neural TTS and returns
 * base64 audio. Keeps the Speech key off the browser.
 *
 * Prosody is sentence-first: classify each sentence's message/tone, then
 * apply inflection for that whole sentence (not word-level emphasis guesses).
 *
 * POST /gus-speak  { text: string }
 * → { audioBase64, contentType, voice }
 */

type SentenceTone =
  | 'question'
  | 'instruction'
  | 'warning'
  | 'diagnosis'
  | 'alternative'
  | 'reassurance'
  | 'result'
  | 'context'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization' }, 401)

  const userClient = createUserClient(authHeader)
  const user = await getAuthedUser(userClient)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const key = Deno.env.get('AZURE_SPEECH_KEY')
  const region = Deno.env.get('AZURE_SPEECH_REGION') ?? 'canadacentral'
  const voice = Deno.env.get('AZURE_SPEECH_VOICE') ?? 'en-US-DavisNeural'
  if (!key) {
    return jsonResponse({ error: 'Azure Speech is not configured on the server.' }, 503)
  }

  let text = ''
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text.trim() : ''
  } catch {
    return jsonResponse({ error: 'Expected JSON body with text' }, 400)
  }

  if (!text) return jsonResponse({ error: 'Empty text' }, 400)
  if (text.length > 900) text = text.slice(0, 900)
  text = speakableSlashAsOr(text)

  const sentences = splitSentences(text)
  const tones = sentences.map(classifySentenceTone)

  // Davis: stick to "chat" only — other styles (e.g. hopeful) can 4xx and
  // leave the client with silence if fallback also misbehaves.
  const ssml = `<?xml version="1.0"?>
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="en-US">
  <voice name="${voice}">
    <mstts:express-as style="chat" styledegree="0.55">
      ${renderSentences(sentences, tones)}
    </mstts:express-as>
  </voice>
</speak>`

  try {
    let ttsRes = await fetchAzure(region, key, ssml)
    if (!ttsRes.ok) {
      const detail = await ttsRes.text()
      console.error('Azure TTS failed (styled)', ttsRes.status, detail)
      // Retry without express-as — still keep sentence-level prosody.
      const ssmlNoStyle = `<?xml version="1.0"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    ${renderSentences(sentences, tones)}
  </voice>
</speak>`
      ttsRes = await fetchAzure(region, key, ssmlNoStyle)
    }
    if (!ttsRes.ok) {
      const detail = await ttsRes.text()
      console.error('Azure TTS failed (prosody)', ttsRes.status, detail)
      const plain = `<?xml version="1.0"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    <prosody rate="-6%" pitch="-6%">${escapeXml(text)}</prosody>
  </voice>
</speak>`
      ttsRes = await fetchAzure(region, key, plain)
    }
    if (!ttsRes.ok) {
      const detail2 = await ttsRes.text()
      return jsonResponse({ error: 'Azure TTS failed', detail: detail2.slice(0, 300) }, 502)
    }

    const buffer = await ttsRes.arrayBuffer()
    if (buffer.byteLength < 64) {
      console.error('Azure TTS returned near-empty audio', buffer.byteLength)
      return jsonResponse({ error: 'Azure TTS returned empty audio' }, 502)
    }

    return audioJson(buffer, voice)
  } catch (err) {
    console.error('gus-speak error', err)
    return jsonResponse({ error: 'Speech synthesis request failed.' }, 502)
  }
})

function fetchAzure(region: string, key: string, body: string) {
  return fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'IronMedicGus',
    },
    body,
  })
}

function audioJson(buffer: ArrayBuffer, voice: string) {
  const buf = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return jsonResponse({
    audioBase64: btoa(binary),
    contentType: 'audio/mpeg',
    voice,
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** "(pass)/(fail)" and "yes/no" → "or" so TTS never says "slash". */
function speakableSlashAsOr(text: string): string {
  return text
    .replace(/\(([^)/]+)\)\s*\/\s*\(([^)/]+)\)/g, '$1 or $2')
    .replace(/\b([A-Za-z][A-Za-z0-9+\-]*)\s*\/\s*([A-Za-z][A-Za-z0-9+\-]*)\b/g, '$1 or $2')
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const part of parts) {
    const dash = part.split(/\s+[—–]\s+/)
    if (dash.length === 2 && dash[0]!.split(/\s+/).length >= 4 && dash[1]!.split(/\s+/).length >= 3) {
      out.push(dash[0]!.trim())
      out.push(dash[1]!.trim())
    } else {
      out.push(part)
    }
  }
  return out.length ? out : [text]
}

function classifySentenceTone(sentence: string): SentenceTone {
  const s = sentence.trim()
  const lower = s.toLowerCase()

  if (
    /\?\s*$/.test(s) ||
    /^(did|do|does|can|could|is|are|was|were|have|has|will|would|what|which|where|when|why|how)\b/i.test(s)
  ) {
    return 'question'
  }

  if (/\b(careful|caution|danger|warning|lock ?out|high pressure|watch out|don't get|do not)\b/i.test(lower)) {
    return 'warning'
  }

  if (
    /^(check|unplug|measure|test|try|look|pull|push|swap|replace|verify|read|probe|wiggle|listen|feel|see if|go ahead|start by|next)\b/i
      .test(s) ||
    /\b(unplug|measure|multimeter|ohm(?:s)?|continuity|see if it|then check|then try)\b/i.test(lower)
  ) {
    return 'instruction'
  }

  if (
    /\b(good news|easy fix|simple check|don't worry|no big deal|that'?s normal|should be fine|you'?re alright)\b/i
      .test(lower)
  ) {
    return 'reassurance'
  }

  if (
    /\b(or |other (?:bet|possibility)|runner-?up|alternatively|could also|might also|second (?:guess|likely))\b/i
      .test(lower)
  ) {
    return 'alternative'
  }

  if (
    /\b(pass|fail|that (?:means|confirms)|rules? out|if it reads|infinite|no continuity|dead short)\b/i.test(lower)
  ) {
    return 'result'
  }

  if (
    /\b(probably|likely|most likely|burned? out|failed|dead|open|shorted|worn|that'?s your|i'?d bet|points to)\b/i
      .test(lower)
  ) {
    return 'diagnosis'
  }

  return 'context'
}

function renderSentences(sentences: string[], tones: SentenceTone[]): string {
  return sentences
    .map((sentence, i) => {
      const tone = tones[i] ?? 'context'
      const body = prosodyForTone(tone, sentence)
      const pause = i < sentences.length - 1 ? pauseAfterTone(tone) : ''
      return `${body}${pause}`
    })
    .join(' ')
}

function prosodyForTone(tone: SentenceTone, sentence: string): string {
  const cleaned = escapeXml(sentence)

  switch (tone) {
    case 'question':
      return `<prosody rate="-4%" pitch="-3%" contour="(0%, +0%) (50%, +2%) (78%, +12%) (100%, +45%)">${cleaned}</prosody>`
    case 'instruction':
      return `<prosody rate="-11%" pitch="-7%" contour="(0%, +5%) (35%, +1%) (100%, -16%)">${cleaned}</prosody>`
    case 'warning':
      return `<prosody rate="-13%" pitch="-11%" contour="(0%, -2%) (40%, -4%) (100%, -18%)">${cleaned}</prosody>`
    case 'diagnosis':
      return `<prosody rate="-5%" pitch="-5%" contour="(0%, +9%) (28%, +5%) (100%, -12%)">${cleaned}</prosody>`
    case 'alternative':
      return `<prosody rate="-6%" pitch="-4%" contour="(0%, +2%) (45%, +7%) (100%, -8%)">${cleaned}</prosody>`
    case 'reassurance':
      return `<prosody rate="-4%" pitch="-2%" contour="(0%, +7%) (55%, +4%) (100%, -5%)">${cleaned}</prosody>`
    case 'result':
      return `<prosody rate="-8%" pitch="-6%" contour="(0%, +1%) (60%, -2%) (100%, -14%)">${cleaned}</prosody>`
    default:
      return `<prosody rate="-7%" pitch="-6%" contour="(0%, +3%) (100%, -10%)">${cleaned}</prosody>`
  }
}

function pauseAfterTone(tone: SentenceTone): string {
  switch (tone) {
    case 'warning':
      return '<break time="480ms"/>'
    case 'instruction':
      return '<break time="420ms"/>'
    case 'question':
      return '<break time="380ms"/>'
    case 'diagnosis':
      return '<break time="320ms"/>'
    case 'result':
      return '<break time="340ms"/>'
    default:
      return '<break time="280ms"/>'
  }
}
