import { useEffect, useState, type ReactElement } from 'react'
import type { ToastPayload, ToastType } from '../../utils/toast'

type ToastItem = ToastPayload & {
  id: string
}

function getToastClass(type: ToastType): string {
  return `toast-item ${type}`
}

export default function ToastContainer(): ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handleToast(event: Event): void {
      const customEvent = event as CustomEvent<ToastPayload>
      const id = `${Date.now()}-${Math.random()}`

      setToasts((currentToasts) => [
        ...currentToasts,
        {
          id,
          message: customEvent.detail.message,
          type: customEvent.detail.type
        }
      ])

      window.setTimeout(() => {
        setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
      }, 3500)
    }

    window.addEventListener('app-toast', handleToast)

    return () => {
      window.removeEventListener('app-toast', handleToast)
    }
  }, [])

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div className={getToastClass(toast.type)} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}