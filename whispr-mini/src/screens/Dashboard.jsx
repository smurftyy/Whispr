import { createElement, useEffect, useMemo } from 'react'
import { CheckCircle2, Clock3, Layers, Plus } from 'lucide-react'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import StatusBadge from '../components/StatusBadge'
import { useReminders } from '../hooks/useReminders'
import {
  getReminderStatus,
  getReminderSubtitle,
  getReminderTitle,
  getStatusTheme,
} from '../utils/reminder'
import { getTelegramFirstName, getTelegramWebApp, initTelegramViewport } from '../utils/telegram'

function StatCard({ icon, value, label, iconClassName = '' }) {
  return (
    <div className="aspect-square rounded-2xl bg-[#1a1a1a] p-4 sm:p-5">
      {createElement(icon, { size: 18, className: iconClassName })}
      <p className="mt-8 font-display text-4xl leading-none text-white sm:text-5xl">{value}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
    </div>
  )
}

function Dashboard({ onOpenCreate, onOpenDetail }) {
  const { data, isLoading } = useReminders()
  const reminders = useMemo(() => data?.reminders || [], [data])
  const firstName = getTelegramFirstName()

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

  return (
    <div className="whispr-shell">
      <TopBar />

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

          <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
            {isLoading &&
              [1, 2, 3].map((placeholder) => (
                <div
                  key={placeholder}
                  className="whispr-card h-28 animate-pulse rounded-2xl bg-[#191919]"
                />
              ))}

            {!isLoading && reminders.length === 0 && (
              <div className="whispr-card rounded-2xl bg-[#191919] p-5 text-sm text-white/65">
                No reminders yet. Tap + to create your first one.
              </div>
            )}

            {!isLoading &&
              reminders.map((reminder) => {
                const status = getReminderStatus(reminder)
                const statusTheme = getStatusTheme(status)

                return (
                  <button
                    key={reminder.id}
                    type="button"
                    onClick={() => onOpenDetail(reminder.id)}
                    className="w-full rounded-2xl border-0 p-5 text-left transition duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: statusTheme.cardBg }}
                  >
                    <p className="font-display text-[2rem] leading-tight text-white">
                      {getReminderTitle(reminder)}
                    </p>
                    <p className="mt-2 truncate text-sm text-white/65">
                      {getReminderSubtitle(reminder)}
                    </p>
                    <StatusBadge status={status} className="mt-4" />
                  </button>
                )
              })}
          </div>
        </section>
      </main>

      <button
        type="button"
        aria-label="Create reminder"
        onClick={onOpenCreate}
        className="fixed bottom-[6.3rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_20px_35px_rgba(0,0,0,0.45)] transition duration-200 active:scale-95 sm:right-6"
      >
        <Plus size={24} />
      </button>

      <BottomNav />
    </div>
  )
}

export default Dashboard
