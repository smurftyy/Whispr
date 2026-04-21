import { createElement, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Clock3, Layers, Plus, Trash2 } from 'lucide-react'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/StatusBadge'
import { useDeleteReminder, useReminders } from '../hooks/useReminders'
import {
  getReminderRelativeTime,
  getReminderStatus,
  getReminderSubtitle,
  getReminderTitle,
  getStatusTheme,
} from '../utils/reminder'
import { getTelegramFirstName, getTelegramWebApp, initTelegramViewport } from '../utils/telegram'

function StatCard({ icon, value, label, iconClassName = '' }) {
  return (
    <div className="aspect-square rounded-2xl bg-[var(--whispr-surface)] p-4 sm:p-5">
      {createElement(icon, { size: 18, className: iconClassName })}
      <p className="mt-8 font-display text-4xl leading-none text-white sm:text-5xl">{value}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
    </div>
  )
}

function Dashboard({ onOpenCreate, onOpenDetail, activeTab, onNavigate }) {
  const { data, isLoading } = useReminders()
  const { mutate: deleteReminder, isPending: isDeleting } = useDeleteReminder()
  const reminders = useMemo(() => data?.reminders || [], [data])
  const firstName = getTelegramFirstName()
  const [reminderPendingDelete, setReminderPendingDelete] = useState(null)

  useEffect(() => {
    initTelegramViewport()
    getTelegramWebApp()?.BackButton?.hide?.()
  }, [])

  const stats = useMemo(() => {
    let upcoming = 0
    let done = 0

    reminders.forEach((reminder) => {
      const status = getReminderStatus(reminder)
      if (status === 'completed') done += 1
      if (status === 'upcoming') upcoming += 1
    })

    return {
      total: reminders.length,
      upcoming,
      done,
    }
  }, [reminders])

  const handleOpenDeleteConfirm = (event, reminder) => {
    event.stopPropagation()
    setReminderPendingDelete(reminder)
  }

  const handleCancelDelete = () => {
    if (isDeleting) return
    setReminderPendingDelete(null)
  }

  const handleConfirmDelete = () => {
    if (!reminderPendingDelete?.id || isDeleting) return

    deleteReminder(reminderPendingDelete.id, {
      onSuccess: () => {
        setReminderPendingDelete(null)
      },
      onError: () => {
        setReminderPendingDelete(null)
      },
    })
  }

  return (
    <div className="whispr-shell">
      <TopBar onOpenSettings={() => onNavigate?.('settings')} />

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-[10rem] pt-20 sm:px-6 sm:pt-24">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">
            TODAY&apos;S OVERVIEW
          </p>
          <h1 className="mt-2 text-5xl leading-[0.95] text-white sm:text-6xl">
            Hello, {firstName}
          </h1>
        </section>

        <section className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={Layers} value={stats.total} label="TOTAL" iconClassName="text-white/45" />
          <StatCard icon={Clock3} value={stats.upcoming} label="UPCOMING" iconClassName="text-white/80" />
          <StatCard icon={CheckCircle2} value={stats.done} label="DONE" iconClassName="text-[#4bdd65]" />
        </section>

        <section className="mt-8 flex min-h-0 flex-1 flex-col">
          <h2 className="text-4xl text-white">Your Reminders</h2>

          <motion.div
            className="mt-4 flex-1 space-y-4 overflow-y-auto"
            initial={false}
          >
            {isLoading &&
              [1, 2, 3].map((placeholder, i) => (
                <motion.div
                  key={placeholder}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.07 }}
                  className="whispr-card h-28 animate-pulse rounded-2xl bg-[var(--whispr-surface)]"
                />
              ))}

            {!isLoading && reminders.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="whispr-card rounded-2xl bg-[var(--whispr-surface)] p-5 text-sm text-white/65"
              >
                No reminders yet. Tap + to create your first one.
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {!isLoading &&
                reminders.map((reminder, i) => {
                  const status = getReminderStatus(reminder)
                  const statusTheme = getStatusTheme(status)
                  const relativeTime = getReminderRelativeTime(reminder)

                  return (
                    <motion.article
                      key={reminder.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.24, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="relative w-full rounded-2xl border-0 p-5 text-left transition duration-200 hover:-translate-y-0.5"
                      style={{ backgroundColor: statusTheme.cardBg }}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenDetail(reminder.id)}
                        className="absolute inset-0 z-0 rounded-2xl"
                        aria-label={`Open reminder ${getReminderTitle(reminder)}`}
                      />

                      <motion.button
                        type="button"
                        onClick={(event) => handleOpenDeleteConfirm(event, reminder)}
                        whileTap={{ scale: 0.85 }}
                        className="absolute right-4 top-4 z-20 rounded-full bg-black/25 p-2 text-white/80 transition hover:bg-black/40 hover:text-white"
                        aria-label={`Delete reminder ${getReminderTitle(reminder)}`}
                      >
                        <Trash2 size={16} />
                      </motion.button>

                      <div className="relative z-10 pr-12">
                        <p className="font-display text-[2rem] leading-tight text-white">
                          {getReminderTitle(reminder)}
                        </p>
                        <p className="mt-2 truncate text-sm text-white/65">
                          {getReminderSubtitle(reminder)}
                        </p>
                      </div>

                      <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
                        <StatusBadge status={status} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                          {relativeTime}
                        </span>
                      </div>
                    </motion.article>
                  )
                })}
            </AnimatePresence>
          </motion.div>
        </section>
      </main>

      <ConfirmDialog
        open={Boolean(reminderPendingDelete)}
        title="Delete Reminder"
        message={`Delete "${getReminderTitle(reminderPendingDelete)}"? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        confirmClassName="bg-[#ff9b96] text-[#2a1414]"
      />

      <motion.button
        type="button"
        aria-label="Create reminder"
        onClick={onOpenCreate}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="fixed bottom-[6.3rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_20px_35px_rgba(0,0,0,0.45)] sm:right-6"
      >
        <Plus size={24} />
      </motion.button>

      <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
    </div>
  )
}

export default Dashboard
