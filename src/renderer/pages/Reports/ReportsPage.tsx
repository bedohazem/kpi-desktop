import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Department, Employee, ReportsResult } from '../../types/api'

const currentYear = new Date().getFullYear()

export default function ReportsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [year, setYear] = useState(String(currentYear))
  const [fromMonth, setFromMonth] = useState('1')
  const [toMonth, setToMonth] = useState('12')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  const [report, setReport] = useState<ReportsResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const filteredEmployees = useMemo(() => {
    if (!departmentId) {
      return employees
    }

    return employees.filter((employee) => String(employee.department_id || '') === departmentId)
  }, [employees, departmentId])

  async function generateReport(): Promise<void> {
    setMessage('')

    try {
      setIsLoading(true)

      const result = await window.api.reports.generate({
        year: Number(year),
        from_month: Number(fromMonth),
        to_month: Number(toMonth),
        department_id: departmentId ? Number(departmentId) : null,
        employee_id: employeeId ? Number(employeeId) : null
      })

      setReport(result)
      setMessage('تم إنشاء التقرير')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء التقرير'
      setMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    Promise.all([window.api.departments.list(), window.api.employees.list()])
      .then(([departmentRows, employeeRows]) => {
        if (isMounted) {
          setDepartments(departmentRows)
          setEmployees(employeeRows)
        }
      })
      .catch(() => {
        if (isMounted) {
          setMessage('حدث خطأ أثناء تحميل بيانات التقرير')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <>
      <section className="card">
        <h2>التقارير</h2>

        <div className="form-grid">
          <label>
            السنة
            <input value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))} />
          </label>

          <label>
            من شهر
            <select value={fromMonth} onChange={(event) => setFromMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          <label>
            إلى شهر
            <select value={toMonth} onChange={(event) => setToMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          <label>
            الإدارة
            <select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value)
                setEmployeeId('')
              }}
            >
              <option value="">كل الإدارات</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            الموظف
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">كل الموظفين</option>
              {filteredEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_number || '-'} - {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions-row">
          <button className="primary-button" disabled={isLoading} onClick={generateReport}>
            {isLoading ? 'جاري إنشاء التقرير...' : 'عرض التقرير'}
          </button>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      {report && (
        <>
          <section className="card">
            <div className="section-header">
              <h2>ملخص الإدارات</h2>
              <span>عدد الإدارات: {report.departmentSummary.length}</span>
            </div>

            <div className="report-summary-grid">
              {report.departmentSummary.map((department) => (
                <div className="summary-card" key={String(department.department_id)}>
                  <h3>{department.department_name}</h3>
                  <p>عدد الموظفين: {department.employees_count}</p>
                  <p>عدد التقييمات: {department.evaluations_count}</p>
                  <p>الإجمالي: {department.total.toFixed(2)}</p>
                  <p>المتوسط: {department.average.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>تقرير الموظفين</h2>
              <span>عدد الموظفين: {report.employees.length}</span>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>رقم الموظف</th>
                    <th>الاسم</th>
                    <th>الوظيفة</th>
                    <th>الإدارة</th>
                    {report.months.map((month) => (
                      <th key={month}>شهر {month}</th>
                    ))}
                    <th>الإجمالي</th>
                    <th>المتوسط</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>

                <tbody>
                  {report.employees.length === 0 ? (
                    <tr>
                      <td colSpan={report.months.length + 7}>لا توجد بيانات في هذا التقرير</td>
                    </tr>
                  ) : (
                    report.employees.map((employee) => (
                      <tr key={employee.employee_id}>
                        <td>{employee.employee_number || '-'}</td>
                        <td>{employee.employee_name}</td>
                        <td>{employee.job_title || '-'}</td>
                        <td>{employee.department_name || '-'}</td>

                        {report.months.map((month) => (
                          <td key={month}>
                            {employee.month_values[String(month)] === null
                              ? '-'
                              : employee.month_values[String(month)]}
                          </td>
                        ))}

                        <td>{employee.total.toFixed(2)}</td>
                        <td>{employee.average.toFixed(2)}</td>
                        <td>{employee.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}