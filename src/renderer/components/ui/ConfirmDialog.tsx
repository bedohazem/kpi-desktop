import type { ReactElement } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): ReactElement | null {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{message}</p>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>
            {cancelText}
          </button>

          <button className={danger ? 'danger-button' : 'primary-button'} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}