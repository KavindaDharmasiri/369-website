import CryptoJS from 'crypto-js'

const SECRET_KEY = process.env.ENCRYPTION_KEY

function getSecretKey(): string {
  if (!SECRET_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return SECRET_KEY
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getSecretKey()).toString()
}

export function decrypt(text: string): string {
  if (!text) return ''
  try {
    const bytes = CryptoJS.AES.decrypt(text, getSecretKey())
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}

export function encryptData(data: any): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), getSecretKey()).toString()
}

export function decryptData(encrypted: string): any {
  if (!encrypted) return null
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, getSecretKey())
    const result = bytes.toString(CryptoJS.enc.Utf8)
    if (!result) return null
    return JSON.parse(result)
  } catch {
    return null
  }
}
