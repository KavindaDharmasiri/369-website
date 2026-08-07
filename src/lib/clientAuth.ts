export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token)
    document.cookie = `authToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken')
  }
  return null
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    document.cookie = 'authToken=; path=/; max-age=0'
  }
}

export function getAuthUser(): any {
  if (typeof window === 'undefined') return null

  const token = getAuthToken()
  if (!token) return null

  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (error) {
    return null
  }
}
