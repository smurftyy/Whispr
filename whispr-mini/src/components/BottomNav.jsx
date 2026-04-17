import { createElement } from 'react'
import { Archive, BookOpenText, CalendarClock, Sparkles } from 'lucide-react'

const items = [
  {
    key: 'journal',
    label: 'JOURNAL',
    Icon: BookOpenText,
  },
  {
    key: 'scheduled',
    label: 'SCHEDULED',
    Icon: CalendarClock,
  },
  {
    key: 'glow',
    label: 'GLOW',
    Icon: Sparkles,
  },
  {
    key: 'archive',
    label: 'ARCHIVE',
    Icon: Archive,
  },
]

function BottomNav() {
  return (
    <nav className="whispr-topbar fixed inset-x-0 bottom-0 z-40 rounded-t-[1.4rem] border-t border-white/10 pb-safe">
      <div className="mx-auto grid h-[76px] w-full max-w-4xl grid-cols-4 items-center px-3">
        {items.map(({ key, label, Icon }) => {
          const active = key === 'journal'

          return (
            <button
              key={key}
              type="button"
              className={`mx-auto flex min-w-[76px] flex-col items-center rounded-2xl px-2 py-2 text-[9px] font-semibold tracking-[0.1em] transition ${
                active ? 'bg-white/14 text-white shadow-[0_10px_20px_rgba(0,0,0,0.35)]' : 'text-white/45 hover:text-white/70'
              }`}
            >
              {createElement(Icon, { size: 16, className: 'mb-1' })}
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
