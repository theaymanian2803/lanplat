import { fetchTranscript } from '../api/transcript.ts'

const videoId = process.argv[2] ?? 'Ma8STQg_9Sg'
const lang = process.argv[3] ?? 'fr'

if (!process.env.SUPADATA_API_KEY?.trim()) {
  console.error('SUPADATA_API_KEY is not set. Add it to .env or the current shell.')
  process.exit(1)
}

delete process.env.TRANSCRIPT_RELAY_URL
delete process.env.TRANSCRIPT_PROXY_URL

const result = await fetchTranscript(videoId, lang)

if (!result.ok) {
  console.error(`FAILED ${result.status} ${result.reason}: ${result.error}`)
  process.exit(1)
}

console.log(`OK ${videoId} (${result.data.languageCode}): ${result.data.cues.length} cues`)
