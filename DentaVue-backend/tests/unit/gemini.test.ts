import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression tests for three transport bugs that only surfaced against a LIVE
 * Gemini key. Every one of them passed typecheck, lint and a schema review, and
 * every one broke the pipeline in production-shaped ways:
 *
 *   1. `thinkingBudget: 0` — accepted by Gemini 2.5 as "off", REJECTED by 3.x
 *      with a bare `400 Request contains an invalid argument`. It killed the
 *      whole narrative pass.
 *   2. Reading `parts[0].text` — Gemini 3.x prepends reasoning parts flagged
 *      `thought: true`, so the obvious implementation returns the model's
 *      thinking and then fails to JSON.parse it.
 *   3. Treating every 404 as permanent — a saturated flash tier answers 404
 *      with an EMPTY body rather than the documented 503, so a transient
 *      capacity blip looked like a fatal misconfiguration.
 *
 * fetch is stubbed, so these never touch the network or spend anything.
 */

const ORIGINAL_ENV = { ...process.env }

async function loadGemini() {
  vi.resetModules()
  return import('@/integrations/gemini.js')
}

const SCHEMA = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gemini-3.6-flash',
    systemInstruction: 'sys',
    prompt: 'prompt',
    schema: SCHEMA,
    maxOutputTokens: 100,
    thinkingBudget: 0,
    ...overrides,
  }
}

/** A well-formed success payload with the given parts. */
function ok(parts: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    }),
  }
}

function fail(status: number, body = '') {
  return { ok: false, status, text: async () => body }
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'k',
    SUPABASE_ANON_KEY: 'k',
    GEMINI_API_KEY: 'test-key',
    GEMINI_TIMEOUT_MS: '5000',
  }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('thinkingConfig', () => {
  it('OMITS thinkingConfig when the budget is 0 — Gemini 3.x 400s on a zero budget', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await generateJson(baseOptions({ thinkingBudget: 0 }))

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.generationConfig).not.toHaveProperty('thinkingConfig')
  })

  it('sends thinkingConfig when a real budget is asked for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await generateJson(baseOptions({ thinkingBudget: 512 }))

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 512 })
  })

  it('always constrains decoding with the response schema', async () => {
    // The schema is the enforcement mechanism for "the model observes, the
    // backend decides" — losing it would let a score field back in.
    const fetchMock = vi.fn().mockResolvedValue(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await generateJson(baseOptions())

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toEqual(SCHEMA)
    expect(body.generationConfig.temperature).toBe(0)
  })

  it('sends the key as a header, never in the URL', async () => {
    // A key in a query string leaks into proxy logs and error trackers.
    const fetchMock = vi.fn().mockResolvedValue(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await generateJson(baseOptions())

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).not.toContain('test-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
  })
})

describe('response parsing', () => {
  it('skips Gemini 3.x thought parts and returns the answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok([
          { text: 'Let me consider the gum margins…', thought: true },
          { text: '{"a":"answer"}' },
        ]),
      ),
    )
    const { generateJson } = await loadGemini()

    const result = await generateJson<{ a: string }>(baseOptions())
    expect(result.data.a).toBe('answer')
  })

  it('joins multiple answer parts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ok([{ text: '{"a":' }, { text: '"split"}' }])),
    )
    const { generateJson } = await loadGemini()

    const result = await generateJson<{ a: string }>(baseOptions())
    expect(result.data.a).toBe('split')
  })

  it('handles a Gemini 2.x single unflagged part', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ text: '{"a":"legacy"}' }])))
    const { generateJson } = await loadGemini()

    const result = await generateJson<{ a: string }>(baseOptions())
    expect(result.data.a).toBe('legacy')
  })

  it('reports which model actually answered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ text: '{"a":"x"}' }])))
    const { generateJson } = await loadGemini()

    const result = await generateJson(baseOptions({ model: 'gemini-3.6-flash' }))
    expect(result.model).toBe('gemini-3.6-flash')
  })
})

describe('retry and fallback', () => {
  it('retries a 503, then succeeds on the same model', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(503, '{"error":{"message":"high demand"}}'))
      .mockResolvedValueOnce(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    const result = await generateJson(baseOptions())
    expect(result.model).toBe('gemini-3.6-flash')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a BODYLESS 404 — that is how a saturated tier reports itself', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(404, ''))
      .mockResolvedValueOnce(ok([{ text: '{"a":"x"}' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await generateJson(baseOptions())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a 404 that carries a message — that is permanent', async () => {
    // e.g. "This model is no longer available to new users", which is what
    // gemini-2.5-flash now returns. Retrying it just wastes time.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fail(404, '{"error":{"message":"no longer available to new users"}}'))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await expect(generateJson(baseOptions())).rejects.toThrow()
    // One attempt on the primary, no retries.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls through to a fallback model when the primary is permanently gone', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('gemini-2.5-flash')
        ? fail(404, '{"error":{"message":"no longer available to new users"}}')
        : ok([{ text: '{"a":"x"}' }]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    const result = await generateJson(
      baseOptions({ model: 'gemini-2.5-flash', fallbackModels: ['gemini-3.6-flash'] }),
    )
    expect(result.model).toBe('gemini-3.6-flash')
  })

  it('falls through when the primary is merely busy, after exhausting its retries', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('busy-model') ? fail(503, 'high demand') : ok([{ text: '{"a":"x"}' }]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    const result = await generateJson(
      baseOptions({ model: 'busy-model', fallbackModels: ['spare-model'] }),
    )
    expect(result.model).toBe('spare-model')
  })

  it('does not double the retry budget when a fallback repeats the primary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(503, 'busy'))
    vi.stubGlobal('fetch', fetchMock)
    const { generateJson } = await loadGemini()

    await expect(
      generateJson(baseOptions({ model: 'same', fallbackModels: ['same', 'same'] })),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(3) // MAX_ATTEMPTS, once
  })

  it('throws a 502 when every model is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(503, 'busy')))
    const { generateJson } = await loadGemini()

    await expect(
      generateJson(baseOptions({ fallbackModels: ['b'] })),
    ).rejects.toMatchObject({ status: 502 })
  })

  it('never leaks the provider error to the caller', async () => {
    // The message reaches the client via scan_analysis.error, so it must not
    // carry provider internals or anything resembling a credential.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(500, 'internal trace with test-key')))
    const { generateJson } = await loadGemini()

    await expect(generateJson(baseOptions())).rejects.toThrow(
      /The analysis service is unavailable/,
    )
  })
})

describe('isGeminiConfigured', () => {
  it('is false when the key is absent, so callers can degrade', async () => {
    delete process.env.GEMINI_API_KEY
    const { isGeminiConfigured } = await loadGemini()
    expect(isGeminiConfigured()).toBe(false)
  })

  it('is true when the key is set', async () => {
    const { isGeminiConfigured } = await loadGemini()
    expect(isGeminiConfigured()).toBe(true)
  })
})
