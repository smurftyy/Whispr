import { createElement, useEffect, useMemo } from 'react'
import { CheckCircle2, Clock3, Layers, Sparkles } from 'lucide-react'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { useReminders } from '../hooks/useReminders'
import {
  formatReminderDate,
  formatReminderTime,
  getReminderDate,
  getReminderStatus,
  getReminderTitle,
} from '../utils/reminder'
import { getTelegramWebApp, initTelegramViewport } from '../utils/telegram'

function MetricCard({ icon, label, value, iconClassName = '' }) {
  return (
    <div className="rounded-2xl bg-[var(--whispr-surface)] p-4 sm:p-5">
      {createElement(icon, { size: 18, className: iconClassName })}
      <p className="mt-4 text-3xl font-semibold leading-none text-white sm:text-4xl">{value}</p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/50">{label}</p>
    </div>
  )
}

function Insights({ activeTab, onNavigate, onOpenDetail }) {
  const { data, isLoading } = useReminders()
  const reminders = useMemo(() => data?.reminders || [], [data])

  useEffect(() => {
    initTelegramViewport()
    getTelegramWebApp()?.BackButton?.hide?.()
  }, [])

  const metrics = useMemo(() => {
    let completed = 0
    let upcoming = 0
    let overdue = 0

    reminders.forEach((reminder) => {
      const status = getReminderStatus(reminder)
      if (status === 'completed') completed += 1
      if (status === 'upcoming') upcoming += 1
      if (status === 'overdue') overdue += 1
    })

    const total = reminders.length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      upcoming,
      overdue,
      completionRate,
    }
  }, [reminders])

  const focusItems = useMemo(() => {
    return reminders
      .filter((reminder) => getReminderStatus(reminder) === 'upcoming')
      .sort((a, b) => {
        const aDate = getReminderDate(a)?.getTime() || Number.MAX_SAFE_INTEGER
        const bDate = getReminderDate(b)?.getTime() || Number.MAX_SAFE_INTEGER
        return aDate - bDate
      })
      .slice(0, 4)
  }, [reminders])

  return (
    <div className="whispr-shell">
      <TopBar onOpenSettings={() => onNavigate?.('settings')} />

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-[8rem] pt-20 sm:px-6 sm:pt-24">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">SNAPSHOT</p>
          <h1 className="mt-2 text-5xl leading-[0.95] text-white sm:text-6xl">Insights</h1>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          <MetricCard icon={Layers} label="TOTAL" value={metrics.total} iconClassName="text-white/50" />
          <MetricCard icon={CheckCircle2} label="DONE RATE" value={`${metrics.completionRate}%`} iconClassName="text-[#4bdd65]" />
          <MetricCard icon={Clock3} label="UPCOMING" value={metrics.upcoming} iconClassName="text-white/80" />
          <MetricCard icon={Sparkles} label="OVERDUE" value={metrics.overdue} iconClassName="text-[#ffb7b3]" />
        </section>

        <section className="mt-7 rounded-2xl bg-[var(--whispr-surface)] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">COMPLETION MOMENTUM</p>
          <div className="mt-3 h-3 rounded-full bg-black/30">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-[#86f5a0] to-[#4bdd65] transition-all duration-300"
              style={{ width: `${metrics.completionRate}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-white/65">
            {metrics.completed} completed out of {metrics.total} reminders.
          </p>
        </section>

        <section className="mt-8 flex min-h-0 flex-1 flex-col">
          <h2 className="text-3xl text-white sm:text-4xl">Focus Queue</h2>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {isLoading &&
              [1, 2, 3].map((placeholder) => (
                <div
                  key={placeholder}
                  className="h-24 animate-pulse rounded-2xl bg-[var(--whispr-surface)]"
                />
              ))}

            {!isLoading && focusItems.length === 0 && (
              <div className="rounded-2xl bg-[var(--whispr-surface)] p-5 text-sm text-white/65">
                No upcoming reminders to focus on right now.
              </div>
            )}

            {!isLoading &&
              focusItems.map((reminder) => {
                const dueDate = getReminderDate(reminder)

                return (
                  <article
                    key={reminder.id}
                    className="relative rounded-2xl bg-[#111a2d] p-4 text-left transition duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDetail?.(reminder.id)}
                      className="absolute inset-0 rounded-2xl"
                      aria-label={`Open reminder ${getReminderTitle(reminder)}`}
                    />

                    <div className="relative z-10">
                      <p className="text-lg font-medium text-white sm:text-xl">{getReminderTitle(reminder)}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/50">
                        {formatReminderDate(dueDate)} • {formatReminderTime(dueDate)}
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

export default Insights
