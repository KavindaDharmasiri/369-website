import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function generateToken(payload: any): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): any {
  if (!JWT_SECRET) {
    return null
  }
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}
