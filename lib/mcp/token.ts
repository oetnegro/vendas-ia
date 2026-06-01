import { createHash, randomBytes } from 'crypto'

const TOKEN_PREFIX = 'vimcp_'

export type GeneratedToken = {
  token: string // texto puro — exibido UMA vez, nunca persistido
  prefix: string // primeiros chars, seguros para exibir na UI
  hash: string // sha256 hex — o único valor guardado no banco
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateToken(): GeneratedToken {
  const secret = randomBytes(24).toString('base64url')
  const token = `${TOKEN_PREFIX}${secret}`
  return {
    token,
    prefix: token.slice(0, 14),
    hash: hashToken(token),
  }
}
