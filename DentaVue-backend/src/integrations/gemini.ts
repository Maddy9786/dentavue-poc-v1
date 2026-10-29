import { env } from '@/config/env.js'
import { logger } from '@/config/logger.js'
import { ApiError } from '@/utils/ApiError.js'

/**
 * Gemini client — the only place in the codebase that talks to Google.
 *
 * Plain `fetch` against the REST API rather than the @google/genai SDK: the
 * surface we need is two calls and a JSON schema, Node 20+ has fetch built in,
 * and a dependency on the request path of a health app is a supply-chain
 * decision, not a convenience one. Swapping to the SDK later means rewriting
 * this file and nothing else.
 *
 * SECURITY
 * - The key travels in the `x-goog-api-key` header, never a query string:
 *   query strings end up in proxy logs, browser history and error trackers.
 * - Nothing here logs the key, the image bytes, or the raw response body.
 *   Failures log status + a truncated message, which is enough to debug and
 *   safe to ship to a log aggregator.
 * - This module is server-only. The key sits beside the Supabase service-role
 *   key and is subject to the same rule: it must never reach a browser.
 *
 * RELIABILITY
 * - Every call has a hard timeout (AbortSignal.timeout). Without one a hung
 *   socket would pin an analysis in `pending` forever.
 * - 429 and 5xx are retried with exponential backoff + jitter; 4xx is not,
 *   because retrying a bad request just spends money to fail again.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'

/** Bump when the prompts or the response schema change — stored per analysis. */
export const PROMPT_VERSION = '1.1.0'

/** Subset of Gemini's OpenAPI-flavoured schema dialect that we emit. */
export interface ResponseSchema {
  type: string
  properties?: Record<string, ResponseSchema>
  items?: ResponseSchema
  required?: string[]
  enum?: string[]
  description?: string
  minimum?: number
  maximum?: number
  propertyOrdering?: string[]
}

export interface GeminiImage {
  mimeType: string
  /** Raw bytes; base64-encoded here, never logged. */
  data: Buffer
}

export interface GenerateOptions {
  model: string
  systemInstruction: string
  prompt: string
  images?: GeminiImage[]
  schema: ResponseSchema
  maxOutputTokens: number
  /**
   * Gemini reasons before answering. Zero suits the narrative pass (a formatting
   * job); a small budget measurably helps the vision pass weigh evidence across
   * four frames. Gemini 3.x may reason regardless of a 0 budget — it is a hint,
   * not a switch, which is why `extractText` filters thought parts out.
   */
  thinkingBudget: number
  /**
   * Tried in order when the primary is unavailable. Availability, not quality:
   * Google's flash tiers routinely return 503 (and, oddly, bare 404s) under
   * load, and an analysis should not fail because one tier was busy.
   *
   * The model that actually answered is recorded on the analysis row, because a
   * severity from one model is not perfectly comparable to another's — bands
   * absorb much of that, but a cross-model comparison should be detectable.
   */
  fallbackModels?: string[]
  /**
   * How finely Gemini tokenises each image — the single biggest cost lever in
   * this integration, and one with a surprising default.
   *
   * Measured on a 390x280 intraoral photo against gemini-3.6-flash:
   *   unset / HIGH  1092 tokens   (the DEFAULT — the most expensive setting)
   *   MEDIUM         540 tokens
   *   LOW            266 tokens
   *
   * Note it is resolution-of-analysis, not image size: the photo above is
   * already small, so downscaling before upload saves nothing. This does.
   * Four frames at HIGH is ~4,400 input tokens; at LOW it is ~1,060.
   */
  mediaResolution?: 'MEDIA_RESOLUTION_LOW' | 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH'
}

export interface GenerateResult<T> {
  data: T
  /** Which model actually answered — may be a fallback. Persisted per analysis. */
  model: string
  latencyMs: number
  inputTokens: number
  /** Visible answer + reasoning tokens: what is actually BILLED as output. */
  outputTokens: number
  /** The reasoning share of `outputTokens`, broken out for cost analysis. */
  thoughtTokens: number
}

interface GeminiPart {
  text?: string
  /** Gemini 3.x marks reasoning parts. They are NOT the answer. */
  thought?: boolean
  thoughtSignature?: string
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    /**
     * Reasoning tokens. Reported SEPARATELY from candidatesTokenCount but
     * billed at the output rate — so output cost is the sum of the two. On a
     * trivial prompt this was 84 thought tokens against 1 visible one, i.e. the
     * invisible part dominated the bill. Counting only `candidatesTokenCount`
     * silently under-reports spend by a large multiple.
     */
    thoughtsTokenCount?: number
  }
  error?: { message?: string }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3

/**
 * The answer text, skipping reasoning.
 *
 * Gemini 3.x can return several parts: reasoning ones flagged `thought: true`,
 * then the answer. Reading `parts[0].text` blindly — which is the obvious
 * implementation — yields the model's thinking instead of its JSON, and then
 * fails to parse. Concatenating the non-thought parts is correct for both 2.x
 * (one part, no flag) and 3.x.
 */
function extractText(payload: GeminiResponse): string | null {
  const parts = payload.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  return text.length > 0 ? text : null
}

/**
 * Whether a failed response is worth retrying.
 *
 * The 404 case is not obvious and cost real debugging time: when a flash tier is
 * saturated, the API sometimes answers `404` with an EMPTY body instead of the
 * documented `503`. A 404 that carries a message ("no longer available to new
 * users") is a genuine, permanent routing failure and must not be retried — so
 * the presence of a body is the discriminator.
 */
function isRetryable(status: number, body: string): boolean {
  if (RETRYABLE.has(status)) return true
  return status === 404 && body.trim().length === 0
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** True when the integration is configured. Callers degrade rather than throw. */
export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY)
}

/**
 * One schema-constrained generation.
 *
 * `responseMimeType: 'application/json'` plus `responseSchema` is what makes the
 * output parseable without defensive string surgery — Gemini constrains
 * decoding to the schema, so the model cannot return prose, a markdown fence,
 * or a field we did not ask for. That is also the enforcement mechanism for the
 * project's core rule: the vision schema has no score/band/level fields, so the
 * model cannot emit them however the prompt is worded.
 *
 * `temperature: 0` reduces run-to-run drift at the source. It does not remove
 * it — vision severity judgements vary regardless — which is why scoring.ts
 * exists. Treat this as a helpful default, not the fix.
 */
export async function generateJson<T>(options: GenerateOptions): Promise<GenerateResult<T>> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) throw new ApiError(503, 'AI analysis is not configured')

  const parts: Record<string, unknown>[] = [{ text: options.prompt }]
  for (const image of options.images ?? []) {
    parts.push({
      inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') },
    })
  }

  const body = {
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: options.schema,
      maxOutputTokens: options.maxOutputTokens,
      // OMITTED rather than sent as 0 when we don't want thinking. Gemini 2.5
      // accepted `thinkingBudget: 0` as "off"; Gemini 3.x rejects it outright
      // with a bare `400 Request contains an invalid argument` — those models
      // always reason, so the budget is a ceiling, not a switch. Omitting the
      // field lets each model apply its own default and keeps one code path
      // working across both generations.
      ...(options.thinkingBudget > 0
        ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
        : {}),
      ...(options.mediaResolution ? { mediaResolution: options.mediaResolution } : {}),
    },
  }

  // Primary first, then each fallback. Duplicates removed so a fallback that
  // repeats the primary does not silently double the retry budget.
  const chain = [...new Set([options.model, ...(options.fallbackModels ?? [])])]
  const startedAt = Date.now()
  let lastError = 'Unknown error'

  for (const model of chain) {
    const url = `${API_ROOT}/models/${model}:generateContent`

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
        })
      } catch (err) {
        // Network failure or timeout — both worth one more try.
        lastError = err instanceof Error ? err.message : 'Request failed'
        if (attempt === MAX_ATTEMPTS) break
        await sleep(backoffMs(attempt))
        continue
      }

      if (!response.ok) {
        // Read the body for the message only; it never reaches the client.
        const detail = await response.text().catch(() => '')
        lastError = `${response.status} ${detail.slice(0, 200)}`
        logger.warn({ status: response.status, model, attempt }, 'Gemini request failed')

        if (isRetryable(response.status, detail)) {
          if (attempt < MAX_ATTEMPTS) {
            await sleep(backoffMs(attempt))
            continue
          }
          break // exhausted this model; try the next in the chain
        }
        // Permanent for this model (bad name, gated, malformed request). Move
        // on rather than burning retries — the next model may well work.
        break
      }

      const payload = (await response.json()) as GeminiResponse
      const text = extractText(payload)

      if (!text) {
        // Truncated (MAX_TOKENS) or safety-blocked. Retrying an identical
        // deterministic request rarely helps, so move to the next model.
        const finish = payload.candidates?.[0]?.finishReason ?? 'no candidate'
        logger.error({ finishReason: finish, model }, 'Gemini returned no content')
        lastError = `no content (${finish})`
        break
      }

      let data: T
      try {
        data = JSON.parse(text) as T
      } catch {
        // Should be impossible under responseSchema; treated as a service fault
        // rather than a crash so the caller can mark the analysis failed.
        logger.error({ model }, 'Gemini returned unparseable JSON')
        lastError = 'unparseable JSON'
        break
      }

      if (model !== options.model) {
        logger.warn({ requested: options.model, used: model }, 'Gemini fell back to another model')
      }

      const thoughtTokens = payload.usageMetadata?.thoughtsTokenCount ?? 0
      return {
        data,
        model,
        latencyMs: Date.now() - startedAt,
        inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        // Reasoning is billed at the output rate, so it belongs in the output
        // total. Reporting only the visible answer would make the stored cost
        // figures — and any budget built on them — badly optimistic.
        outputTokens: (payload.usageMetadata?.candidatesTokenCount ?? 0) + thoughtTokens,
        thoughtTokens,
      }
    }
  }

  logger.error({ chain, lastError }, 'Gemini exhausted every model')
  throw new ApiError(502, 'The analysis service is unavailable')
}

/** Exponential backoff with jitter, so retries from many workers do not align. */
function backoffMs(attempt: number): number {
  const base = 400 * 2 ** (attempt - 1)
  return base + Math.floor(Math.random() * 200)
}
