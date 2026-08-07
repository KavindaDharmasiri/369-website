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
  const bytes = CryptoJS.AES.decrypt(text, getSecretKey())
  return bytes.toString(CryptoJS.enc.Utf8)
}

export function encryptData(data: any): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), getSecretKey()).toString()
}

export function decryptData(encrypted: string): any {
  const bytes = CryptoJS.AES.decrypt(encrypted, getSecretKey())
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}
