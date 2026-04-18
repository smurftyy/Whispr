import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Archive, CheckCircle2, Clock3 } from 'lucide-react'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { useReminders } from '../hooks/useReminders'
import {
  getReminderRelativeTime,
  getReminderStatus,
  getReminderSubtitle,
  getReminderTitle,
  getStatusTheme,
} from '../utils/reminder'
import { getTelegramWebApp, initTelegramViewport } from '../utils/telegram'

const FILTER_OPTIONS = ['all', 'completed', 'overdue']

function ArchivePage({ activeTab, onNavigate, onOpenDetail }) {
  const { data, isLoading } = useReminders()
  const [filter, setFilter] = useState('all')

  const reminders = useMemo(() => data?.reminders || [], [data])

  useEffect(() => {
    initTelegramViewport()
    getTelegramWebApp()?.BackButton?.hide?.()
  }, [])

  const archivedReminders = useMemo(() => {
    const archiveCandidates = reminders.filter((reminder) => {
      const status = getReminderStatus(reminder)
      return status === 'completed' || status === 'overdue'
    })

    if (filter === 'all') return archiveCandidates

    return archiveCandidates.filter((reminder) => getReminderStatus(reminder) === filter)
  }, [filter, reminders])

  const summary = useMemo(() => {
    let completed = 0
    let overdue = 0

    reminders.forEach((reminder) => {
      const status = getReminderStatus(reminder)
      if (status === 'completed') completed += 1
      if (status === 'overdue') overdue += 1
    })

    return { completed, overdue }
  }, [reminders])

  return (
    <div className="whispr-shell">
      <TopBar onOpenSettings={() => onNavigate?.('settings')} />

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-[8rem] pt-20 sm:px-6 sm:pt-24">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">RECORDS</p>
          <h1 className="mt-2 text-5xl leading-[0.95] text-white sm:text-6xl">Archive</h1>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-[var(--whispr-surface)] p-4 sm:p-5">
            <CheckCircle2 size={18} className="text-[#4bdd65]" />
            <p className="mt-4 text-3xl font-semibold leading-none text-white sm:text-4xl">{summary.completed}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/50">Completed</p>
          </div>

          <div className="rounded-2xl bg-[var(--whispr-surface)] p-4 sm:p-5">
            <Clock3 size={18} className="text-[#ffb7b3]" />
            <p className="mt-4 text-3xl font-semibold leading-none text-white sm:text-4xl">{summary.overdue}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/50">Overdue</p>
          </div>
        </section>

        <section className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((item) => {
            const active = filter === item
            return (
              <motion.button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                  active ? 'bg-white text-black' : 'bg-white/10 text-white/75'
                }`}
              >
                {item}
              </motion.button>
            )
          })}
        </section>

        <section className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center gap-2">
            <Archive size={16} className="text-white/60" />
            <p className="text-sm text-white/70">Saved reminders</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {isLoading &&
              [1, 2, 3].map((placeholder) => (
                <div
                  key={placeholder}
                  className="h-24 animate-pulse rounded-2xl bg-[var(--whispr-surface)]"
                />
              ))}

            {!isLoading && archivedReminders.length === 0 && (
              <div className="rounded-2xl bg-[var(--whispr-surface)] p-5 text-sm text-white/65">
                Nothing in archive for this filter yet.
              </div>
            )}

            {!isLoading &&
              archivedReminders.map((reminder) => {
                const status = getReminderStatus(reminder)
                const statusTheme = getStatusTheme(status)

                return (
                  <article
                    key={reminder.id}
                    className="relative rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: statusTheme.cardBg }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDetail?.(reminder.id)}
                      className="absolute inset-0 rounded-2xl"
                      aria-label={`Open reminder ${getReminderTitle(reminder)}`}
                    />

                    <div className="relative z-10">
                      <p className="text-lg font-medium text-white sm:text-xl">{getReminderTitle(reminder)}</p>
                      <p className="mt-1 truncate text-sm text-white/65">{getReminderSubtitle(reminder)}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                        {getReminderRelativeTime(reminder)}
                      </p>
                    </div>
                  </article>
                )
              })}
          </div>
        </section>
      </main>

      <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
    </div>
  )
}

export default ArchivePage
