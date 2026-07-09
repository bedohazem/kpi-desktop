import { useEffect, useState, type ReactElement } from 'react'
import type { DashboardStats } from '../../types/api'
import { toast } from '../../utils/toast'

export default function DashboardPage(): ReactElement {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function loadStats(): Promise<void> {
    try {
      setIsLoading(true)
      const result = await window.api.dashboard.stats()
      setStats(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل الرئيسية'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.api.dashboard
      .stats()
      .then((result) => {
        if (isMounted) {
          setStats(result)
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل الرئيسية')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h2>الرئيسية</h2>
            <span>
              ملخص شهر {stats?.currentMonth || '-'} / {stats?.currentYear || '-'}
            </span>
          </div>

          <button className="secondary-button" disabled={isLoading} onClick={loadStats}>
            {isLoading ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <span>الإدارات النشطة</span>
            <strong>{stats?.activeDepartmentsCount ?? 0}</strong>
          </div>

          <div className="dashboard-card">
            <span>الإدارات غير النشطة</span>
            <strong>{stats?.inactiveDepartmentsCount ?? 0}</strong>
          </div>

          <div className="dashboard-card">
            <span>الموظفين النشطين</span>
            <strong>{stats?.activeEmployeesCount ?? 0}</strong>
          </div>

          <div className="dashboard-card">
            <span>الموظفين غير النشطين</span>
            <strong>{stats?.inactiveEmployeesCount ?? 0}</strong>
          </div>

          <div className="dashboard-card">
            <span>تقييمات الشهر الحالي</span>
            <strong>{stats?.currentMonthEvaluationsCount ?? 0}</strong>
          </div>

          <div className="dashboard-card warning-card">
            <span>لم يتم تقييمهم هذا الشهر</span>
            <strong>{stats?.currentMonthMissingEvaluationsCount ?? 0}</strong>
          </div>

          <div className="dashboard-card">
            <span>إجمالي تقييم الشهر</span>
            <strong>{stats?.currentMonthTotal.toFixed(2) ?? '0.00'}</strong>
          </div>

          <div className="dashboard-card success-card">
            <span>متوسط تقييم الشهر</span>
            <strong>{stats?.currentMonthAverage.toFixed(2) ?? '0.00'}</strong>
          </div>
        </div>
      </section>
    </>
  )
}