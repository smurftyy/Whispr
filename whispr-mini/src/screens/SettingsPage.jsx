import { useEffect, useMemo } from 'react'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { getTelegramFirstName, getTelegramWebApp, initTelegramViewport } from '../utils/telegram'

function SettingsPage({ activeTab, onNavigate }) {
  const firstName = getTelegramFirstName()

  useEffect(() => {
    initTelegramViewport()
    getTelegramWebApp()?.BackButton?.hide?.()
  }, [])

  const deviceMeta = useMemo(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US'

    return { timezone, locale }
  }, [])

  return (
    <div className="whispr-shell">
      <TopBar onOpenSettings={() => onNavigate?.('settings')} />

      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-[8rem] pt-20 sm:px-6 sm:pt-24">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">PREFERENCES</p>
          <h1 className="mt-2 text-5xl leading-[0.95] text-white sm:text-6xl">Settings</h1>
        </section>

        <section className="mt-6 rounded-2xl bg-[var(--whispr-surface)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.13em] text-white/50">PROFILE</p>
              <p className="mt-2 text-3xl text-white sm:text-4xl">{firstName}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
              Mini App
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-white/70 sm:grid-cols-2">
            <div className="rounded-xl bg-black/25 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Timezone</p>
              <p className="mt-1">{deviceMeta.timezone}</p>
            </div>
            <div className="rounded-xl bg-black/25 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Locale</p>
              <p className="mt-1">{deviceMeta.locale}</p>
            </div>
          </div>
        </section>
      </main>

      <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
    </div>
  )
}

export default SettingsPage
