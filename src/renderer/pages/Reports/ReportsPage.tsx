import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Department, Employee, ReportsResult } from '../../types/api'
import * as XLSX from 'xlsx'
import { toast } from '../../utils/toast'
import {
  flattenDepartmentTree,
  getDepartmentAndDescendantIds
} from '../../utils/departments-tree'

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

  const departmentOptions = useMemo(() => flattenDepartmentTree(departments), [departments])

  const selectedReportDepartmentIds = useMemo(() => {
    if (!departmentId) {
      return null
    }

    return new Set(getDepartmentAndDescendantIds(departments, Number(departmentId)))
  }, [departments, departmentId])

  const filteredEmployees = useMemo(() => {
    if (!selectedReportDepartmentIds) {
      return employees
    }

    return employees.filter(
      (employee) =>
        employee.department_id !== null && selectedReportDepartmentIds.has(employee.department_id)
    )
  }, [employees, selectedReportDepartmentIds])

  async function generateReport(): Promise<void> {
    toast.info('جاري انشاء تقرير ...')

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
      toast.success('تم إنشاء التقرير')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء التقرير'
      toast.error(errorMessage)
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
          toast.error('حدث خطأ أثناء تحميل بيانات التقرير')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  function exportReportToExcel(): void {
  if (!report) {
    toast.warning('اعرض التقرير الأول قبل التصدير')
    return
  }

  const employeeRows = report.employees.map((employee, index) => {
    const row: Record<string, string | number> = {
      م: index + 1,
      'اسم الموظف': employee.employee_name,
      المؤهل: employee.qualification || '',
      الإدارة: employee.department_name || '',
      الوظيفة: employee.job_title || ''
    }

    for (const reportMonth of report.months) {
      const value = employee.month_values[String(reportMonth)]
      row[`شهر ${reportMonth}`] = value === null ? '' : value
    }

    row['الإجمالي'] = Number(employee.total.toFixed(2))
    row['المتوسط'] = Number(employee.average.toFixed(2))
    row['ملاحظات'] = employee.notes || ''

    return row
  })

  const departmentRows = report.departmentSummary.map((department) => ({
    الإدارة: department.department_name,
    'عدد الموظفين': department.employees_count,
    'عدد التقييمات': department.evaluations_count,
    الإجمالي: Number(department.total.toFixed(2)),
    المتوسط: Number(department.average.toFixed(2))
  }))

  const workbook = XLSX.utils.book_new()

  const employeesSheet = XLSX.utils.json_to_sheet(employeeRows)
  const departmentsSheet = XLSX.utils.json_to_sheet(departmentRows)

  XLSX.utils.book_append_sheet(workbook, employeesSheet, 'تقرير الموظفين')
  XLSX.utils.book_append_sheet(workbook, departmentsSheet, 'ملخص الإدارات')

  const fileName = `KPI_Report_${year}_${fromMonth}_to_${toMonth}.xlsx`

  XLSX.writeFile(workbook, fileName)
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return '-'
  }

  return Number(value).toFixed(2).replace(/\\.00$/, '')
}

function buildReportPdfHtml(): string {
  if (!report) {
    return ''
  }

  const monthHeaders = report.months.map((monthNumber) => `<th>شهر<br>${monthNumber}</th>`).join('')

  const monthColumns = report.months.map(() => '<col style="width: 4.2%" />').join('')

  const employeeRows = report.employees
    .map((employee, index) => {
      const monthCells = report.months
        .map((monthNumber) => {
          const value = employee.month_values[String(monthNumber)]
          return `<td>${value === null ? '-' : formatNumber(value)}</td>`
        })
        .join('')

      return `
        <tr>
          <td>${index + 1}</td>
          <td class="text-cell">${escapeHtml(employee.employee_name)}</td>
          <td class="text-cell">${escapeHtml(employee.qualification || '-')}</td>
          <td class="text-cell">${escapeHtml(employee.department_name || '-')}</td>
          <td class="text-cell">${escapeHtml(employee.job_title || '-')}</td>
          ${monthCells}
          <td>${formatNumber(employee.total)}</td>
          <td>${formatNumber(employee.average)}</td>
          <td class="text-cell">${escapeHtml(employee.notes || '-')}</td>
        </tr>
      `
    })
    .join('')

  const summaryRows = report.departmentSummary
    .map(
      (department) => `
        <tr>
          <td class="text-cell">${escapeHtml(department.department_name)}</td>
          <td>${department.employees_count}</td>
          <td>${department.evaluations_count}</td>
          <td>${formatNumber(department.total)}</td>
          <td>${formatNumber(department.average)}</td>
        </tr>
      `
    )
    .join('')

  return `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير التقييمات</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: white;
            color: #111;
            font-family: Tahoma, Arial, sans-serif;
            direction: rtl;
          }

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            border-bottom: 2px solid #111;
            padding-bottom: 6px;
          }

          h1 {
            margin: 0;
            font-size: 18px;
          }

          .meta {
            font-size: 10px;
            line-height: 1.7;
            text-align: left;
            direction: rtl;
          }

          h2 {
            margin: 10px 0 6px;
            font-size: 13px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 10px;
          }

          th,
          td {
            border: 1px solid #333;
            padding: 3px 2px;
            font-size: 8.3px;
            line-height: 1.25;
            text-align: center;
            vertical-align: middle;
            color: #111;
            overflow-wrap: anywhere;
          }

          th {
            background: #e5e7eb;
            font-weight: 700;
          }

          .text-cell {
            text-align: right;
            font-size: 8px;
          }

          .summary-table th,
          .summary-table td {
            font-size: 10px;
            padding: 5px;
          }

          .no-data {
            text-align: center;
            padding: 20px;
            font-size: 13px;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>تقرير التقييمات الشهرية</h1>
          </div>

          <div class="meta">
            السنة: ${escapeHtml(year)}<br />
            من شهر: ${escapeHtml(fromMonth)} إلى شهر: ${escapeHtml(toMonth)}<br />
            تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <h2>ملخص الإدارات</h2>

        <table class="summary-table">
          <thead>
            <tr>
              <th>الإدارة</th>
              <th>عدد الموظفين</th>
              <th>عدد التقييمات</th>
              <th>الإجمالي</th>
              <th>المتوسط</th>
            </tr>
          </thead>

          <tbody>
            ${summaryRows || '<tr><td class="no-data" colspan="5">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>

        <h2>تقرير الموظفين</h2>

        <table>
          <colgroup>
            <col style="width: 3%" />
            <col style="width: 11%" />
            <col style="width: 9%" />
            <col style="width: 9%" />
            <col style="width: 9%" />
            ${monthColumns}
            <col style="width: 5%" />
            <col style="width: 5%" />
            <col style="width: 7.6%" />
          </colgroup>

          <thead>
            <tr>
              <th>م</th>
              <th>اسم الموظف</th>
              <th>المؤهل</th>
              <th>الإدارة</th>
              <th>الوظيفة</th>
              ${monthHeaders}
              <th>الإجمالي</th>
              <th>المتوسط</th>
              <th>ملاحظات</th>
            </tr>
          </thead>

          <tbody>
            ${employeeRows || `<tr><td class="no-data" colspan="${report.months.length + 8}">لا توجد بيانات</td></tr>`}
          </tbody>
        </table>
      </body>
    </html>
  `
}

async function exportReportToPdf(): Promise<void> {
  if (!report) {
    toast.info('اعرض التقرير الأول قبل حفظ PDF')
    return
  }

  try {
    const result = await window.api.reports.savePdf({
      html: buildReportPdfHtml(),
      fileName: `KPI_Report_${year}_${fromMonth}_to_${toMonth}.pdf`
    })

    if (result.canceled) {
      toast.info('تم إلغاء حفظ PDF')
      return
    }

    toast.success('تم حفظ ملف PDF بنجاح')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ PDF'
    toast.error(errorMessage)
  }
}

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
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {'— '.repeat(department.level)}
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
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions-row">
          <button className="primary-button" disabled={isLoading} onClick={generateReport}>
            {isLoading ? 'جاري إنشاء التقرير...' : 'عرض التقرير'}
          </button>

          <button className="secondary-button" disabled={!report} onClick={exportReportToExcel}>
            تصدير Excel
          </button>

          <button className="secondary-button" disabled={!report} onClick={exportReportToPdf}>
            حفظ PDF
          </button>
        </div>

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
                    <th>م</th>
                    <th>اسم الموظف</th>
                    <th>المؤهل</th>
                    <th>الإدارة</th>
                    <th>الوظيفة</th>
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
                      <td colSpan={report.months.length + 8}>لا توجد بيانات في هذا التقرير</td>
                    </tr>
                  ) : (
                    report.employees.map((employee, index) => (
                      <tr key={employee.employee_id}>
                        <td>{index + 1}</td>
                        <td>{employee.employee_name}</td>
                        <td>{employee.qualification || '-'}</td>
                        <td>{employee.department_name || '-'}</td>
                        <td>{employee.job_title || '-'}</td>

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