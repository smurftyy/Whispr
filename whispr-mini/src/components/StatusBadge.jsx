import { getStatusTheme } from '../utils/reminder'

function StatusBadge({ status, className = '' }) {
  const theme = getStatusTheme(status)

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.12em] ${className}`}
      style={{
        color: theme.badgeText,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: theme.dot }}
      />
      {theme.label}
    </span>
  )
}

export default StatusBadge
