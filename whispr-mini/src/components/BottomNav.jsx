import { createElement } from 'react'
import { motion } from 'framer-motion'
import { Archive, BookOpenText, Layers, Settings } from 'lucide-react'

const items = [
  {
    key: 'journal',
    label: 'JOURNAL',
    Icon: BookOpenText,
    screen: 'dashboard',
  },
  {
    key: 'insights',
    label: 'INSIGHTS',
    Icon: Layers,
    screen: 'insights',
  },
  {
    key: 'settings',
    label: 'SETTINGS',
    Icon: Settings,
    screen: 'settings',
  },
  {
    key: 'archive',
    label: 'ARCHIVE',
    Icon: Archive,
    screen: 'archive',
  },
]

function BottomNav({ activeTab, onNavigate }) {
  const handleTabClick = (screen) => {
    onNavigate?.(screen)
  }

  return (
    <nav className="whispr-topbar fixed inset-x-0 bottom-0 z-40 rounded-t-[1.4rem] border-t border-white/10 pb-safe">
      <div className="mx-auto grid h-[76px] w-full max-w-4xl grid-cols-4 items-center px-3">
        {items.map(({ key, label, Icon, screen }) => {
          const active = activeTab === screen

          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => handleTabClick(screen)}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className={`mx-auto flex min-w-[76px] flex-col items-center rounded-2xl px-2 py-2 text-[9px] font-semibold tracking-[0.1em] transition ${
                active ? 'bg-white/14 text-white shadow-[0_10px_20px_rgba(0,0,0,0.35)]' : 'text-white/45 hover:text-white/70'
              }`}
            >
              {createElement(Icon, { size: 16, className: 'mb-1' })}
              {label}
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
