export function getTelegramWebApp() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.Telegram?.WebApp || null
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user || null
}

export function getTelegramFirstName() {
  return getTelegramUser()?.first_name || 'User'
}

export function getTelegramAvatar() {
  return getTelegramUser()?.photo_url || null
}

export function initTelegramViewport() {
  const webApp = getTelegramWebApp()
  webApp?.ready?.()
  webApp?.expand?.()
}
