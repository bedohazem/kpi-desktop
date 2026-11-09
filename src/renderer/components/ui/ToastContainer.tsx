import { useEffect, useState, type ReactElement } from 'react';
import type { ToastPayload, ToastType } from '../../utils/toast';

type ToastItem = ToastPayload & {
  id: string;
};

function getToastClass(type: ToastType): string {
  return `toast-item ${type}`;
}

export default function ToastContainer(): ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event): void {
      const customEvent = event as CustomEvent<ToastPayload>;
      const id = `${Date.now()}-${Math.random()}`;

      setToasts((currentToasts) => [
        ...currentToasts,
        {
          id,
          message: customEvent.detail.message,
          type: customEvent.detail.type,
          confirmation: customEvent.detail.confirmation,
        },
      ]);

      if (!customEvent.detail.confirmation) {
        window.setTimeout(() => {
          setToasts((currentToasts) =>
            currentToasts.filter((toast) => toast.id !== id),
          );
        }, 3500);
      }
    }

    window.addEventListener('app-toast', handleToast);

    return () => {
      window.removeEventListener('app-toast', handleToast);
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div className={getToastClass(toast.type)} key={toast.id}>
          <div>{toast.message}</div>

          {toast.confirmation && (
            <div className="toast-actions">
              <button
                type="button"
                onClick={() => {
                  setToasts((items) =>
                    items.filter((item) => item.id !== toast.id),
                  );
                  toast.confirmation?.onConfirm();
                }}
              >
                {toast.confirmation.confirmText}
              </button>

              <button
                type="button"
                onClick={() => {
                  setToasts((items) =>
                    items.filter((item) => item.id !== toast.id),
                  );
                  toast.confirmation?.onCancel();
                }}
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
