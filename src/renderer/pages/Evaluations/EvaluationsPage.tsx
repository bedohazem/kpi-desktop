import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { Department, EvaluationEmployee } from '../../types/api'
import { toast } from '../../utils/toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

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
  const [evaluationSearch, setEvaluationSearch] = useState('')
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const [activeEvaluationEmployeeId, setActiveEvaluationEmployeeId] = useState<number | null>(null)
  const evaluationInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)


  const evaluationSummary = useMemo(() => {
    const values = rows
      .map((row) => row.evaluationValueInput.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))

    const total = values.reduce((sum, value) => sum + value, 0)
    const average = values.length > 0 ? total / values.length : 0
    const missing = rows.filter((row) => !row.evaluationValueInput.trim()).length

    return {
      total,
      average,
      entered: values.length,
      missing
    }
  }, [rows])

  const visibleEvaluationRows = useMemo(() => {
    const searchText = evaluationSearch.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        !searchText ||
        row.employee_name.toLowerCase().includes(searchText) ||
        (row.job_title || '').toLowerCase().includes(searchText) ||
        (row.department_name || '').toLowerCase().includes(searchText)

      const matchesMissing =
        !showMissingOnly ||
        !row.evaluationValueInput.trim() ||
        row.employee_id === activeEvaluationEmployeeId

      return matchesSearch && matchesMissing
    })
  }, [rows, evaluationSearch, showMissingOnly, activeEvaluationEmployeeId])

  async function loadRows(): Promise<void> {
    toast.info('جاري تحميل التقييمات...')

    try {
      setIsLoading(true)

      const evaluationRows = await window.api.evaluations.listEmployees({
        month: Number(month),
        year: Number(year),
        department_id: departmentId ? Number(departmentId) : null
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
    setCopyDialogOpen(false)
    toast.info('جاري نسخ تقييمات الشهر السابق...')

    try {
      const result = await window.api.evaluations.copyPreviousMonth({
        month: Number(month),
        year: Number(year),
        department_id: departmentId ? Number(departmentId) : null
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

  function requestCopyPreviousMonth(): void {
    setCopyDialogOpen(true)
  }

  function focusNextEvaluationInput(currentIndex: number): void {
    const nextRow = visibleEvaluationRows[currentIndex + 1]

    if (!nextRow) {
      return
    }

    evaluationInputRefs.current[nextRow.employee_id]?.focus()
    evaluationInputRefs.current[nextRow.employee_id]?.select()
  }

  function handleEvaluationKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ): void {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    focusNextEvaluationInput(currentIndex)
  }

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
              <option value="">كل الإدارات</option>
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

          <button className="secondary-button" onClick={requestCopyPreviousMonth}>
            نسخ من الشهر السابق
          </button>

          <button className="primary-button" disabled={isSaving || rows.length === 0} onClick={saveEvaluations}>
            {isSaving ? 'جاري الحفظ...' : 'حفظ التقييمات'}
          </button>
        </div>

      </section>

      {rows.length > 0 && (
        <section className="card">
          <div className="evaluation-summary-grid">
            <div className="evaluation-summary-card">
              <span>عدد الموظفين</span>
              <strong>{rows.length}</strong>
            </div>

            <div className="evaluation-summary-card success-card">
              <span>تم إدخال تقييم</span>
              <strong>{evaluationSummary.entered}</strong>
            </div>

            <div className="evaluation-summary-card warning-card">
              <span>ناقص تقييم</span>
              <strong>{evaluationSummary.missing}</strong>
            </div>

            <div className="evaluation-summary-card">
              <span>الإجمالي</span>
              <strong>{evaluationSummary.total.toFixed(2)}</strong>
            </div>

            <div className="evaluation-summary-card success-card">
              <span>المتوسط</span>
              <strong>{evaluationSummary.average.toFixed(2)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        {rows.length > 0 && (
          <section className="card">
            <div className="form-grid">
              <label>
                بحث داخل الموظفين
                <input
                  value={evaluationSearch}
                  placeholder="اكتب اسم الموظف أو الوظيفة أو الإدارة"
                  onChange={(event) => setEvaluationSearch(event.target.value)}
                />
              </label>

              <label className="checkbox-label inline-checkbox">
                <input
                  type="checkbox"
                  checked={showMissingOnly}
                  onChange={(event) => setShowMissingOnly(event.target.checked)}
                />
                إظهار الناقص تقييمهم فقط
              </label>
            </div>
          </section>
        )}

        <div className="section-header">
          <h2>قائمة تقييمات الشهر</h2>
          <span>
            المعروض: {visibleEvaluationRows.length} / الإجمالي: {rows.length}
          </span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>       
                <th>م</th>         
                <th>الاسم</th>
                <th>الوظيفة</th>
                <th>الإدارة</th>
                <th>التقييم</th>
                <th>ملاحظات</th>
              </tr>
            </thead>

            <tbody>
              {visibleEvaluationRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {rows.length === 0 ? 'اختار الشهر ثم اضغط تحميل الموظفين' : 'لا توجد نتائج مطابقة للبحث'}
                  </td>
                </tr>
              ) : (
                visibleEvaluationRows.map((row, index) => (
                  <tr key={row.employee_id}>
                    <td>{index + 1}</td>
                    <td>{row.employee_name}</td>
                    <td>{row.job_title || '-'}</td>
                    <td>{row.department_name || '-'}</td>
                    <td>
                      <input
                        ref={(element) => {
                          evaluationInputRefs.current[row.employee_id] = element
                        }}
                        className="table-input"
                        value={row.evaluationValueInput}
                        inputMode="decimal"
                        onFocus={(event) => {
                          setActiveEvaluationEmployeeId(row.employee_id)
                          event.target.select()
                        }}
                        onBlur={() => {
                          setActiveEvaluationEmployeeId(null)
                        }}
                        onKeyDown={(event) => handleEvaluationKeyDown(event, index)}
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

      <ConfirmDialog
        open={copyDialogOpen}
        title="نسخ تقييمات الشهر السابق"
        message="هل تريد نسخ تقييمات الشهر السابق؟ القيم الموجودة حاليًا لن يتم استبدالها."
        confirmText="نسخ"
        cancelText="إلغاء"
        onConfirm={() => {
          void copyPreviousMonth()
        }}
        onCancel={() => setCopyDialogOpen(false)}
      />
    </>
  )
}