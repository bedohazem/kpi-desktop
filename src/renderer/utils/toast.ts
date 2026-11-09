export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastPayload = {
  message: string;
  type: ToastType;
  confirmation?: {
    confirmText: string;
    onConfirm: () => void;
    onCancel: () => void;
  };
};

function showToast(
  message: string,
  type: ToastType,
  confirmation?: ToastPayload['confirmation'],
): void {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>('app-toast', {
      detail: { message, type, confirmation },
    }),
  );
}

export const toast = {
  success: (message: string): void => showToast(message, 'success'),
  error: (message: string): void => showToast(message, 'error'),
  info: (message: string): void => showToast(message, 'info'),
  warning: (message: string): void => showToast(message, 'warning'),

  confirm: (
    message: string,
    confirmText: string,
    onConfirm: () => void,
    onCancel: () => void,
  ): void =>
    showToast(message, 'warning', {
      confirmText,
      onConfirm,
      onCancel,
    }),
};
