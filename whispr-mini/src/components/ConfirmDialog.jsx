import { AnimatePresence, motion as Motion } from 'framer-motion'

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  confirmClassName = 'bg-white text-black',
}) {
  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/65" onClick={onCancel} />

          <Motion.div
            className="relative w-full max-w-sm rounded-2xl bg-[#191919] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h3 className="font-display text-3xl leading-tight text-white">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{message}</p>

            <div className="mt-6 flex items-center gap-3">
              <Motion.button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                whileTap={{ scale: 0.95 }}
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLabel}
              </Motion.button>
              <Motion.button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
              >
                {isLoading ? 'Please wait...' : confirmLabel}
              </Motion.button>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConfirmDialog
