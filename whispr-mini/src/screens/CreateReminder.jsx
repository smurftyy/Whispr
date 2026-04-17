import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Mic, Sparkles } from 'lucide-react'
import TopBar from '../components/TopBar'
import { useCreateReminder, useExtractReminder } from '../hooks/useReminders'
import { formatReminderDate, formatReminderTime } from '../utils/reminder'
import { getTelegramWebApp } from '../utils/telegram'

function CreateReminder({ onNavigateDashboard }) {
  const [text, setText] = useState('')

  const {
    mutate: extractReminder,
    reset: resetExtraction,
    data: extractionData,
    isPending: isExtracting,
    isError: extractFailed,
  } = useExtractReminder()

  const {
    mutate: createReminder,
    isPending: isCreating,
  } = useCreateReminder()

  const trimmedText = text.trim()
  const extracted = extractionData?.extracted || null

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

  useEffect(() => {
    if (!trimmedText) {
      resetExtraction()
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      extractReminder(trimmedText)
    }, 600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [extractReminder, resetExtraction, trimmedText])

  const extractedDate = useMemo(() => {
    if (!extracted?.eventTime) return null

    const parsed = new Date(extracted.eventTime)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [extracted])

  const canConfirm = Boolean(extracted && !isExtracting && !isCreating)

  const handleConfirm = () => {
    if (!extracted || isCreating) return

    createReminder(
      {
        extracted,
      },
      {
        onSuccess: () => {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success')
          onNavigateDashboard()
        },
      },
    )
  }

  return (
    <div className="whispr-shell">
      <TopBar />

      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-40 pt-24 sm:px-6 sm:pt-28">
        <header>
          <h1 className="text-6xl leading-[0.95] text-white sm:text-7xl">Whispr it.</h1>
          <p className="mt-2 text-sm text-white/60">
           Define it.
          </p>
        </header>

        <section className="relative mt-8">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="e.g., Remind me to buy coffee tomorrow at 10am..."
            className="whispr-card min-h-[140px] w-full resize-none rounded-2xl bg-[var(--whispr-surface)] p-6 pr-20 text-lg text-white placeholder:text-white/30 focus:outline-none"
          />

          <button
            type="button"
            aria-label="Voice input"
            className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/12 text-white/90 backdrop-blur"
          >
            <Mic size={20} />
          </button>
        </section>

        {trimmedText && (
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2 pl-1">
              <Sparkles size={14} className="text-white" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                EXTRACTED INTENT
              </p>
            </div>

            {isExtracting && (
              <div className="whispr-card animate-pulse rounded-2xl bg-[var(--whispr-surface)] p-6">
                <div className="h-9 w-44 rounded-md bg-white/10" />
                <div className="mt-5 flex gap-3">
                  <div className="h-9 w-32 rounded-xl bg-white/10" />
                  <div className="h-9 w-28 rounded-xl bg-white/10" />
                </div>
              </div>
            )}

            {!isExtracting && extracted && (
              <div className="whispr-card relative overflow-hidden rounded-2xl bg-[var(--whispr-surface)] p-6">
                <div className="hidden" />
                <div className="relative z-10">
                  <p className="font-display text-5xl leading-none text-white sm:text-6xl">
                    {extracted.task || 'Untitled reminder'}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-[#232323] px-3 py-2 text-sm text-white/90">
                      <CalendarDays size={16} className="text-white/65" />
                      {formatReminderDate(extractedDate || extracted.eventTime)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-xl bg-[#232323] px-3 py-2 text-sm text-white/90">
                      <Clock3 size={16} className="text-white/65" />
                      {formatReminderTime(extractedDate || extracted.eventTime)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!isExtracting && extractFailed && (
              <p className="text-sm text-[#ffafaa]">
                Could not extract a reminder from that text. Try adding a clearer date and time.
              </p>
            )}
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/85 to-transparent px-4 pb-safe pt-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="whispr-pill flex w-full items-center justify-center gap-2 rounded-full bg-[var(--whispr-surface)] px-6 py-4 text-lg font-semibold text-white transition duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? 'Creating...' : 'Confirm Reminder'}
            <CheckCircle2 size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateReminder
