export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type ToastPayload = {
  message: string
  type: ToastType
}

function showToast(message: string, type: ToastType): void {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>('app-toast', {
      detail: {
        message,
        type
      }
    })
  )
}

export const toast = {
  success: (message: string): void => showToast(message, 'success'),
  error: (message: string): void => showToast(message, 'error'),
  info: (message: string): void => showToast(message, 'info'),
  warning: (message: string): void => showToast(message, 'warning')
}