import { Settings, UserCircle2 } from 'lucide-react'
import { getTelegramAvatar, getTelegramFirstName } from '../utils/telegram'

function getInitials(name) {
  if (!name) return 'U'

  const trimmed = name.trim()
  if (!trimmed) return 'U'

  return trimmed.charAt(0).toUpperCase()
}

function TopBar({ onOpenSettings }) {
  const firstName = getTelegramFirstName()
  const avatar = getTelegramAvatar()

  const handleOpenSettings = () => {
    if (typeof onOpenSettings === 'function') {
      onOpenSettings()
      return
    }

    window.Telegram?.WebApp?.showPopup?.({
      title: 'Settings',
      message: 'Settings coming soon.',
      buttons: [{ type: 'close' }],
    })
  }

  return (
    <header className="whispr-topbar fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <p className="font-display text-[2rem] font-extrabold italic leading-none text-white sm:text-[2.1rem]">
          Whispr
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Settings"
            onClick={handleOpenSettings}
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <Settings size={18} />
          </button>

          {avatar ? (
            <img
              src={avatar}
              alt={`${firstName} avatar`}
              className="h-8 w-8 rounded-full object-cover shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold text-white">
              {getInitials(firstName)}
              <UserCircle2 size={30} className="absolute inset-0 m-auto opacity-20" />
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopBar
