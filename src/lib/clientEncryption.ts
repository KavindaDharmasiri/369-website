import CryptoJS from 'crypto-js'

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY

function getSecretKey(): string {
  if (!SECRET_KEY) {
    throw new Error('NEXT_PUBLIC_ENCRYPTION_KEY environment variable is not set')
  }
  return SECRET_KEY
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
