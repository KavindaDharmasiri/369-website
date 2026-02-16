import crypto from 'crypto'
import CryptoJS from 'crypto-js'

const SECRET_KEY = process.env.ENCRYPTION_KEY || '369-secret-key-32-chars-long!'

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString()
}

export function decrypt(text: string): string {
  const bytes = CryptoJS.AES.decrypt(text, SECRET_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}
