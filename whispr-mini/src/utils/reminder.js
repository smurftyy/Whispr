const STATUS_THEME = {
  upcoming: {
    label: 'UPCOMING',
    badgeText: '#9fb8ff',
    dot: '#6e8dff',
    cardBg: '#0f1a2e',
  },
  completed: {
    label: 'COMPLETED',
    badgeText: '#7ce08d',
    dot: '#43d564',
    cardBg: '#0d1f10',
  },
  overdue: {
    label: 'OVERDUE',
    badgeText: '#ffafaa',
    dot: '#ff8a82',
    cardBg: '#200f0f',
  },
}

const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function parseDate(input) {
  if (!input) return null

  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function getReminderTitle(reminder) {
  return (
    reminder?.task ||
    reminder?.title ||
    reminder?.extracted?.task ||
    'Untitled reminder'
  )
}

export function getReminderDate(reminder) {
  return parseDate(
    reminder?.deadline ||
      reminder?.eventTime ||
      reminder?.datetime ||
      reminder?.date ||
      reminder?.extracted?.eventTime ||
      reminder?.extracted?.deadline,
  )
}

export function getReminderStatus(reminder) {
  const rawStatus = String(reminder?.status || '').toLowerCase()

  if (rawStatus === 'completed') {
    return 'completed'
  }

  const dueDate = getReminderDate(reminder)
  if (dueDate && dueDate.getTime() < Date.now()) {
    return 'overdue'
  }

  return 'upcoming'
}

export function getStatusTheme(status) {
  return STATUS_THEME[status] || STATUS_THEME.upcoming
}

export function getReminderSubtitle(reminder) {
  const note =
    reminder?.notes ||
    reminder?.description ||
    reminder?.originalMessage ||
    reminder?.extracted?.notes

  if (note && note.trim().length > 0) {
    return note.trim()
  }

  const dueDate = getReminderDate(reminder)
  if (!dueDate) {
    return 'No extra notes'
  }

  return `${formatReminderDate(dueDate)} at ${formatReminderTime(dueDate)}`
}

export function formatReminderDate(input, timeZone) {
  const date = input instanceof Date ? input : parseDate(input)
  if (!date) return '--'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
}

export function formatReminderTime(input, timeZone) {
  const date = input instanceof Date ? input : parseDate(input)
  if (!date) return '--'

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatReminderRelativeTime(input) {
  const date = input instanceof Date ? input : parseDate(input)
  if (!date) return ''

  const diff = date.getTime() - Date.now()
  const absDiff = Math.abs(diff)

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  let unit = 'minute'
  let divisor = minute

  if (absDiff >= week) {
    unit = 'week'
    divisor = week
  } else if (absDiff >= day) {
    unit = 'day'
    divisor = day
  } else if (absDiff >= hour) {
    unit = 'hour'
    divisor = hour
  }

  const value = Math.round(diff / divisor)
  return capitalize(relativeTimeFormat.format(value, unit))
}

export function getReminderRelativeTime(reminder) {
  const dueDate = getReminderDate(reminder)
  if (!dueDate) return ''

  return formatReminderRelativeTime(dueDate)
}
