import { useEffect, useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, Clock3, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/StatusBadge'
import { useCompleteReminder, useDeleteReminder, useReminders } from '../hooks/useReminders'
import {
  formatReminderDate,
  formatReminderRelativeTime,
  formatReminderTime,
  getReminderDate,
  getReminderStatus,
  getReminderTitle,
} from '../utils/reminder'
import { getTelegramWebApp } from '../utils/telegram'

function ReminderDetail({ reminderId, onNavigateDashboard, onNavigateEdit }) {
  const { data, isLoading } = useReminders()
  const reminders = useMemo(() => data?.reminders || [], [data])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { mutate: deleteReminder, isPending: isDeleting } = useDeleteReminder()
  const { mutate: completeReminder, isPending: isCompleting } = useCompleteReminder()

  const reminder = useMemo(
    () => reminders.find((entry) => entry.id === reminderId || entry.shortId === reminderId),
    [reminders, reminderId],
  )

  const reminderDate = getReminderDate(reminder)
  const reminderStatus = getReminderStatus(reminder)
  const notesContent = reminder?.notes || reminder?.originalMessage || ''
  const scheduledReminders = reminder?.scheduledReminders || []
  const notificationTiming = reminder?.notificationTiming || []

  useEffect(() => {
    const webApp = getTelegramWebApp()
    const backButton = webApp?.BackButton

    if (!backButton) return undefined

    const handleBack = () => {
      onNavigateDashboard()
    }

    backButton.show()
    backButton.onClick(handleBack)

    return () => {
      backButton.offClick(handleBack)
      backButton.hide()
    }
  }, [onNavigateDashboard])

  const handleDelete = () => {
    if (!reminder?.id || isDeleting) return

    deleteReminder(reminder.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onNavigateDashboard()
      },
      onError: () => {
        setShowDeleteConfirm(false)
      },
    })
  }

  return (
    <div className="whispr-shell">
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Motion.button
              type="button"
              aria-label="Back"
              onClick={onNavigateDashboard}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-white shadow-[0_12px_20px_rgba(0,0,0,0.3)]"
            >
              <ArrowLeft size={18} />
            </Motion.button>
            <StatusBadge status={reminderStatus} />
          </div>

          <Motion.button
            type="button"
            aria-label="Edit reminder"
            onClick={() => onNavigateEdit?.(reminderId)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-white shadow-[0_12px_20px_rgba(0,0,0,0.3)]"
          >
            <Pencil size={18} />
          </Motion.button>
        </div>
      </header>

      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-44 pt-24 sm:px-6 sm:pt-28">
        {isLoading && (
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="whispr-card h-56 animate-pulse rounded-2xl bg-[var(--whispr-surface)]"
          />
        )}

        {!isLoading && !reminder && (
          <div className="whispr-card rounded-2xl bg-[var(--whispr-surface)] p-6 text-white/70">
            Reminder not found.
          </div>
        )}

        {!isLoading && reminder && (
          <>
            <h1 className="max-w-3xl text-6xl leading-[0.96] text-white sm:text-7xl">
              {getReminderTitle(reminder)}
            </h1>

            <section className="mt-8 rounded-2xl bg-[var(--whispr-surface)] p-5 sm:p-6">
              <div className="grid grid-cols-2 divide-x divide-white/10">
                <div className="pr-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    DATE
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-white/90">
                    <CalendarDays size={17} className="text-white/60" />
                    <span>{formatReminderDate(reminderDate)}</span>
                  </div>
                </div>

                <div className="pl-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    TIME
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-white/90">
                    <Clock3 size={17} className="text-white/60" />
                    <span>{formatReminderTime(reminderDate)}</span>
                  </div>
                </div>
              </div>

              {notesContent && (
                <>
                  <div className="my-5 h-px bg-white/10" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      NOTES
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{notesContent}</p>
                  </div>
                </>
              )}

              {(scheduledReminders.length > 0 || notificationTiming.length > 0) && (
                <>
                  <div className="my-5 h-px bg-white/10" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      SCHEDULED NOTIFICATIONS
                    </p>

                    <div className="mt-3 space-y-2">
                      {scheduledReminders.length > 0
                        ? scheduledReminders.map((notification, index) => (
                            <div
                              key={`${notification.scheduledFor}-${index}`}
                              className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm text-white/85">
                                  {formatReminderDate(notification.scheduledFor)} at {formatReminderTime(notification.scheduledFor)}
                                </p>
                                <p className="text-[11px] text-white/55">
                                  {formatReminderRelativeTime(notification.scheduledFor)}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                  notification.sent ? 'text-[#7ce08d]' : 'text-white/55'
                                }`}
                              >
                                {notification.sent ? 'Sent' : 'Pending'}
                              </span>
                            </div>
                          ))
                        : notificationTiming.map((timing) => (
                            <div
                              key={timing}
                              className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                            >
                              <p className="text-sm text-white/85">
                                {timing} minutes before due time
                              </p>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                                Planned
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/86 to-transparent px-4 pb-safe pt-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          <Motion.button
            type="button"
            onClick={() => {
              if (!reminder?.id || isCompleting) return
              completeReminder(reminder.id, {
                onSuccess: () => {
                  getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success')
                  onNavigateDashboard()
                },
                onError: () => {
                  getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('error')
                },
              })
            }}
            disabled={!reminder || isCompleting}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="whispr-pill rounded-full bg-white px-6 py-4 text-base font-medium text-black disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isCompleting ? 'Completing…' : 'Mark as Completed'}
          </Motion.button>

          <Motion.button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!reminder || isDeleting}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="whispr-pill flex items-center justify-center gap-2 rounded-full bg-[#2a1414] px-6 py-4 text-base font-medium text-[#ff9b96] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 size={18} />
            {isDeleting ? 'Deleting...' : 'Delete Reminder'}
          </Motion.button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Reminder"
        message={`Delete "${getReminderTitle(reminder)}"? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        confirmClassName="bg-[#ff9b96] text-[#2a1414]"
      />
    </div>
  )
}

export default ReminderDetail
