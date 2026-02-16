import CryptoJS from 'crypto-js'

const SECRET_KEY = '369-secret-key-32-chars-long!'

export function encryptData(data: any): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString()
}

export function decryptData(encrypted: string): any {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY)
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}
