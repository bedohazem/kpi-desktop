import { useEffect, useState, type ReactElement } from 'react'
import type { Department, EvaluationEmployee } from '../../types/api'
import { toast } from '../../utils/toast'

type EvaluationRowState = EvaluationEmployee & {
  evaluationValueInput: string
  notesInput: string
}

const currentDate = new Date()

export default function EvaluationsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [rows, setRows] = useState<EvaluationRowState[]>([])

  const [month, setMonth] = useState(String(currentDate.getMonth() + 1))
  const [year, setYear] = useState(String(currentDate.getFullYear()))
  const [departmentId, setDepartmentId] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function loadRows(): Promise<void> {
    toast.info('جاري تحميل التقييمات...')

    if (!departmentId) {
      toast.warning('اختار الإدارة أولًا')
      return
    }

    try {
      setIsLoading(true)

      const evaluationRows = await window.api.evaluations.listEmployees({
        month: Number(month),
        year: Number(year),
        department_id: Number(departmentId)
      })

      setRows(
        evaluationRows.map((row) => ({
          ...row,
          evaluationValueInput: row.evaluation_value === null ? '' : String(row.evaluation_value),
          notesInput: row.evaluation_notes || ''
        }))
      )

      toast.success('تم تحميل الموظفين')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل التقييمات'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  async function saveEvaluations(): Promise<void> {
    toast.info('جاري حفظ التقييمات...')

    if (rows.length === 0) {
      toast.warning('لا توجد بيانات للحفظ')
      return
    }

    try {
      setIsSaving(true)

      await window.api.evaluations.saveMonth({
        month: Number(month),
        year: Number(year),
        items: rows.map((row) => ({
          employee_id: row.employee_id,
          evaluation_value: row.evaluationValueInput ? Number(row.evaluationValueInput) : 0,
          notes: row.notesInput
        }))
      })

      toast.success('تم حفظ تقييمات الشهر بنجاح')
      await loadRows()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ التقييمات'
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  async function copyPreviousMonth(): Promise<void> {
    toast.info('جاري نسخ تقييمات الشهر السابق...')

    if (!departmentId) {
      toast.warning('اختار الإدارة أولًا')
      return
    }

    const confirmed = window.confirm('هل تريد نسخ تقييمات الشهر السابق؟ القيم الموجودة حاليًا لن يتم استبدالها.')

    if (!confirmed) {
      return
    }

    try {
      const result = await window.api.evaluations.copyPreviousMonth({
        month: Number(month),
        year: Number(year),
        department_id: Number(departmentId)
      })

      toast.success(`تم نسخ ${result.copied} تقييم من الشهر السابق`)
      await loadRows()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء النسخ'
      toast.error(errorMessage)
    }
  }

  function updateEvaluationValue(employeeId: number, value: string): void {
    const cleanValue = value.replace(/[^\d.]/g, '')

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.employee_id === employeeId ? { ...row, evaluationValueInput: cleanValue } : row
      )
    )
  }

  function updateNotes(employeeId: number, value: string): void {
    setRows((currentRows) =>
      currentRows.map((row) => (row.employee_id === employeeId ? { ...row, notesInput: value } : row))
    )
  }

  useEffect(() => {
    let isMounted = true

    window.api.departments
      .list()
      .then((departmentRows) => {
        if (isMounted) {
          setDepartments(departmentRows)
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل الإدارات')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <>
      <section className="card">
        <h2>التقييمات الشهرية</h2>

        <div className="form-grid">
          <label>
            السنة
            <input value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))} />
          </label>

          <label>
            الشهر
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => (
                <option key={monthNumber} value={monthNumber}>
                  {monthNumber}
                </option>
              ))}
            </select>
          </label>

          <label>
            الإدارة
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">اختار الإدارة</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions-row">
          <button className="primary-button" disabled={isLoading} onClick={loadRows}>
            {isLoading ? 'جاري التحميل...' : 'تحميل الموظفين'}
          </button>

          <button className="secondary-button" onClick={copyPreviousMonth}>
            نسخ من الشهر السابق
          </button>

          <button className="primary-button" disabled={isSaving || rows.length === 0} onClick={saveEvaluations}>
            {isSaving ? 'جاري الحفظ...' : 'حفظ التقييمات'}
          </button>
        </div>

      </section>

      <section className="card">
        <div className="section-header">
          <h2>قائمة تقييمات الشهر</h2>
          <span>عدد الموظفين: {rows.length}</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>                
                <th>الاسم</th>
                <th>الوظيفة</th>
                <th>الإدارة</th>
                <th>التقييم</th>
                <th>ملاحظات</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>اختار الشهر والإدارة ثم اضغط تحميل الموظفين</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.employee_id}>
                    <td>{row.employee_name}</td>
                    <td>{row.job_title || '-'}</td>
                    <td>{row.department_name || '-'}</td>
                    <td>
                      <input
                        className="table-input"
                        value={row.evaluationValueInput}
                        inputMode="decimal"
                        onChange={(event) => updateEvaluationValue(row.employee_id, event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={row.notesInput}
                        onChange={(event) => updateNotes(row.employee_id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}