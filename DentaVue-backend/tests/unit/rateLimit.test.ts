import express, { type Application } from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  signinAccountLimiter,
  signinLimiter,
  signupLimiter,
} from '@/middlewares/rateLimit.js'
import { errorHandler } from '@/middlewares/errorHandler.js'

/**
 * The auth rate limiters exist to turn thousands of guesses a minute into a
 * handful, so the property that matters is simply: after N attempts, the N+1th
 * is refused with a 429 in the standard error envelope. This mounts each
 * limiter on a bare app and drives it there rather than through the full router
 * — the unit under test is the limiter, not sign-in.
 *
 * Each test builds its OWN app. The store is per-limiter-instance and in-memory,
 * so reusing one across tests would leak counts between them; a fresh app with
 * fresh limiter references keeps each case independent.
 *
 * trust proxy is off here on purpose: supertest talks over loopback, so req.ip
 * is real and there is no proxy header to trust. The production app sets it (see
 * app.ts); getting it wrong there would bucket everyone behind a proxy together.
 */

/**
 * Builds a one-route app behind the given limiters. `probeStatus` is what the
 * handler returns when a request is NOT limited — it matters because
 * signinAccountLimiter has skipSuccessfulRequests on, so only responses >= 400
 * count against it. A test for that limiter must therefore simulate a FAILED
 * sign-in (401), exactly as the real controller does on bad credentials; a 200
 * probe would (correctly) never be counted.
 */
function appWith(
  middlewares: express.RequestHandler[],
  probeStatus = 200,
): Application {
  const app = express()
  app.use(express.json())
  app.post('/probe', ...middlewares, (_req, res) => {
    res.status(probeStatus).json({ success: probeStatus < 400, message: 'probe', data: null })
  })
  app.use(errorHandler)
  return app
}

/** Fires the same request `times` times in series and returns every status. */
async function hammer(
  app: Application,
  times: number,
  body: Record<string, unknown> = {},
): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < times; i++) {
    const res = await request(app).post('/probe').send(body)
    statuses.push(res.status)
  }
  return statuses
}

describe('auth rate limiters', () => {
  it('lets the first 10 sign-in attempts through, then blocks the 11th', async () => {
    // Fresh instance so this test owns its counter. signinLimiter is keyed on
    // IP; supertest is a single loopback client, so every request shares a key.
    // Counts every attempt (skipSuccessfulRequests off), so 200 probes count.
    const app = appWith([signinLimiter])
    const statuses = await hammer(app, 11, { email: 'a@b.com', password: 'x' })

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200))
    expect(statuses[10]).toBe(429)
  })

  it('returns the standard error envelope on a 429, not a bare string', async () => {
    const app = appWith([signinLimiter])
    await hammer(app, 10, { email: 'a@b.com', password: 'x' })

    const res = await request(app).post('/probe').send({ email: 'a@b.com', password: 'x' })
    expect(res.status).toBe(429)
    // Routed through ApiError -> errorHandler, so the web app's
    // getApiErrorMessage renders it exactly like any other failure.
    expect(res.body).toMatchObject({ success: false })
    expect(typeof res.body.message).toBe('string')
    expect(res.body.message).toMatch(/too many/i)
  })

  it('per-account limiter blocks one email after 5 failed attempts', async () => {
    // Keyed on body.email, and only failures count (skipSuccessfulRequests), so
    // the probe returns 401 — a wrong password, which is what it guards against.
    // The 6th failure against ONE address trips it.
    const app = appWith([signinAccountLimiter], 401)
    const statuses = await hammer(app, 6, { email: 'target@dentavue.io', password: 'wrong' })

    expect(statuses.slice(0, 5)).toEqual(Array(5).fill(401))
    expect(statuses[5]).toBe(429)
  })

  it('per-account limiter does not count successful sign-ins against the account', async () => {
    // A correct password (200) must never burn the account's budget — otherwise
    // anyone could lock a known email out by triggering successful-looking
    // requests. Ten successes, still open.
    const app = appWith([signinAccountLimiter], 200)
    const statuses = await hammer(app, 10, { email: 'active@dentavue.io', password: 'right' })

    expect(statuses).toEqual(Array(10).fill(200))
  })

  it('per-account limiter isolates accounts — one email tripping does not block another', async () => {
    const app = appWith([signinAccountLimiter], 401)
    // Burn the whole budget for one address with failed attempts.
    await hammer(app, 6, { email: 'victim@dentavue.io', password: 'wrong' })

    // A different address is unaffected: the key is the email, not the caller.
    const other = await request(app).post('/probe').send({ email: 'bystander@dentavue.io', password: 'x' })
    expect(other.status).toBe(401)
  })

  it('signup limiter blocks after 5 from one source', async () => {
    const app = appWith([signupLimiter])
    const statuses = await hammer(app, 6, { email: 'a@b.com', password: 'x' })

    expect(statuses.slice(0, 5)).toEqual(Array(5).fill(200))
    expect(statuses[5]).toBe(429)
  })
})
