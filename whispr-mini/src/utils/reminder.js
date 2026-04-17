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

export function formatReminderDate(input) {
  const date = input instanceof Date ? input : parseDate(input)
  if (!date) return '--'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatReminderTime(input) {
  const date = input instanceof Date ? input : parseDate(input)
  if (!date) return '--'

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
