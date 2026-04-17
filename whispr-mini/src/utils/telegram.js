import WebApp from '@twa-dev/sdk'

const THEME_PARAM_MAP = {
  bg_color: '--tg-theme-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
  header_bg_color: '--tg-theme-header-bg-color',
  button_color: '--tg-theme-button-color',
  button_text_color: '--tg-theme-button-text-color',
  section_separator_color: '--tg-theme-section-separator-color',
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.Telegram?.WebApp || WebApp || null
}

export function applyTelegramTheme() {
  if (typeof document === 'undefined') {
    return
  }

  const webApp = getTelegramWebApp()
  const themeParams = webApp?.themeParams

  if (!themeParams) {
    return
  }

  const rootStyle = document.documentElement.style
  Object.entries(THEME_PARAM_MAP).forEach(([themeKey, cssVar]) => {
    const value = themeParams[themeKey]
    if (value) {
      rootStyle.setProperty(cssVar, value)
    }
  })
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
  applyTelegramTheme()
}
