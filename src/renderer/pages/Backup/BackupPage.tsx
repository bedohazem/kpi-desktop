import {
  useEffect,
  useState,
  type ReactElement
} from 'react'
import type { BackupStatus } from '../../types/api'
import { toast } from '../../utils/toast'

function formatDate(value: string | null): string {
  if (!value) {
    return 'لم يتم إنشاء نسخة حتى الآن'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function BackupPage(): ReactElement {
  const [status, setStatus] =
    useState<BackupStatus | null>(null)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isChoosingDirectory, setIsChoosingDirectory] =
    useState(false)

  const [isCreatingBackup, setIsCreatingBackup] =
    useState(false)

  const [isChangingEnabled, setIsChangingEnabled] =
    useState(false)

  const [isRestoring, setIsRestoring] =
    useState(false)

  async function loadStatus(): Promise<void> {
    try {
      const result =
        await window.api.backup.getStatus()

      setStatus(result)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل إعدادات النسخ الاحتياطي'

      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.api.backup
      .getStatus()
      .then((result) => {
        if (isMounted) {
          setStatus(result)
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل إعدادات النسخ الاحتياطي'

        toast.error(message)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function chooseDirectory(): Promise<void> {
    try {
      setIsChoosingDirectory(true)

      const result =
        await window.api.backup.chooseDirectory()

      setStatus(result.status)

      if (!result.canceled) {
        toast.success(
          'تم اختيار مكان النسخ الاحتياطي'
        )
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر اختيار مكان النسخ الاحتياطي'

      toast.error(message)
    } finally {
      setIsChoosingDirectory(false)
    }
  }

  async function createBackupNow(): Promise<void> {
    try {
      setIsCreatingBackup(true)

      const result =
        await window.api.backup.createNow()

      setStatus(result)

      toast.success(
        'تم إنشاء النسخة الاحتياطية بنجاح'
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'فشل إنشاء النسخة الاحتياطية'

      toast.error(message)

      await loadStatus()
    } finally {
      setIsCreatingBackup(false)
    }
  }

  async function changeBackupEnabled(
    enabled: boolean
  ): Promise<void> {
    try {
      setIsChangingEnabled(true)

      const result =
        await window.api.backup.setEnabled(
          enabled
        )

      setStatus(result)

      toast.success(
        enabled
          ? 'تم تشغيل النسخ الاحتياطي التلقائي'
          : 'تم إيقاف النسخ الاحتياطي التلقائي'
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تغيير حالة النسخ الاحتياطي'

      toast.error(message)

      await loadStatus()
    } finally {
      setIsChangingEnabled(false)
    }
  }

  async function openBackupDirectory(): Promise<void> {
    try {
      await window.api.backup.openDirectory()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر فتح مجلد النسخ الاحتياطي'

      toast.error(message)
    }
  }

  async function restoreBackup(): Promise<void> {
    const confirmed = window.confirm(
      'سيتم استبدال البيانات الحالية بالنسخة المختارة.\n\n' +
        'سيقوم البرنامج بإنشاء نسخة أمان من البيانات الحالية، ' +
        'ثم سيعيد التشغيل تلقائيًا.\n\n' +
        'هل تريد المتابعة؟'
    )

    if (!confirmed) {
      return
    }

    try {
      setIsRestoring(true)

      const restoreSelection =
        await window.api.backup.chooseRestoreFile()

      if (
        restoreSelection.canceled ||
        !restoreSelection.result
      ) {
        return
      }

      const restartConfirmed = window.confirm(
        `تم تجهيز النسخة:\n` +
          `${restoreSelection.result.fileName}\n\n` +
          'يجب إعادة تشغيل البرنامج لتطبيق الاستعادة.\n\n' +
          'هل تريد إعادة التشغيل الآن؟'
      )

      if (!restartConfirmed) {
        toast.info(
          'تم تجهيز النسخة، وسيتم تطبيقها عند إعادة تشغيل البرنامج'
        )

        return
      }

      toast.success(
        'جاري إعادة تشغيل البرنامج واستعادة البيانات'
      )

      await window.api.backup.restartAfterRestore()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'فشلت عملية استعادة النسخة الاحتياطية'

      toast.error(message)
    } finally {
      setIsRestoring(false)
    }
  }

  if (isLoading || !status) {
    return (
      <section className="card">
        <h2>النسخ الاحتياطي</h2>
        <p>جاري تحميل الإعدادات...</p>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h2>النسخ الاحتياطي</h2>
            <p>
              يتم إنشاء نسخة من قاعدة البيانات عند
              فتح البرنامج، مع الاحتفاظ بآخر 7 نسخ.
            </p>
          </div>

          <span>
            الحالة:{' '}
            {status.enabled
              ? 'مفعل'
              : 'غير مفعل'}
          </span>
        </div>

        <div className="form-grid">
          <label>
            مكان حفظ النسخ الاحتياطية

            <input
              value={
                status.directory ||
                'لم يتم اختيار مكان للحفظ'
              }
              readOnly
            />
          </label>

          <label>
            آخر نسخة احتياطية

            <input
              value={formatDate(
                status.lastBackupAt
              )}
              readOnly
            />
          </label>

          <label>
            آخر ملف تم حفظه

            <input
              value={
                status.lastBackupPath ||
                'لا يوجد'
              }
              readOnly
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={status.enabled}
              disabled={isChangingEnabled}
              onChange={(event) =>
                void changeBackupEnabled(
                  event.target.checked
                )
              }
            />

            إنشاء نسخة تلقائية عند فتح البرنامج
          </label>
        </div>

        {status.lastError && (
          <div className="backup-error-message">
            آخر خطأ: {status.lastError}
          </div>
        )}

        <div className="table-actions">
          <button
            type="button"
            className="primary-button"
            disabled={isChoosingDirectory}
            onClick={() =>
              void chooseDirectory()
            }
          >
            {isChoosingDirectory
              ? 'جاري الاختيار...'
              : 'اختيار مكان الحفظ'}
          </button>


          <button
            type="button"
            className="small-button danger"
            disabled={isRestoring}
            onClick={() =>
              void restoreBackup()
            }
          >
            {isRestoring
              ? 'جاري تجهيز الاستعادة...'
              : 'استعادة نسخة احتياطية'}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={
              !status.configured ||
              isCreatingBackup
            }
            onClick={() =>
              void createBackupNow()
            }
          >
            {isCreatingBackup
              ? 'جاري إنشاء النسخة...'
              : 'إنشاء نسخة الآن'}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={!status.configured}
            onClick={() =>
              void openBackupDirectory()
            }
          >
            فتح مجلد النسخ
          </button>
        </div>
      </section>

      <section className="card">
        <h2>طريقة العمل</h2>

        <p>
          البرنامج يحتفظ تلقائيًا بآخر 7 نسخ فقط،
          ويتم حذف النسخ الأقدم تلقائيًا.
        </p>

        <p>
          يفضل اختيار مجلد على قرص آخر مثل D أو E،
          أو مجلد متزامن مع OneDrive أو Google Drive.
        </p>

        <p>
          لا تختار مجلد البرنامج نفسه كمكان للنسخ
          الاحتياطي.
        </p>
      </section>
    </>
  )
}