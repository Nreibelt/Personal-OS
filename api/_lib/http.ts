/* eslint-disable @typescript-eslint/no-explicit-any */
export function jsonError(res: any, status: number, error: string) {
  res.status(status).json({ error })
}

export function assertAppSecret(req: any, res: any): boolean {
  const expected = process.env.REVOLUT_APP_SECRET?.trim()
  if (!expected) {
    res.status(503).json({ error: 'REVOLUT_APP_SECRET is not configured on the server.' })
    return false
  }
  const header = req.headers['x-revolut-app-secret']
  const provided = Array.isArray(header) ? header[0] : header
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing app secret.' })
    return false
  }
  return true
}
