import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Department, Employee } from '../../types/api'

export default function EmployeesPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [employeeName, setEmployeeName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [qualification, setQualification] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('')
  const [employeeNotes, setEmployeeNotes] = useState('')
  const [employeeActive, setEmployeeActive] = useState(true)

  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('')
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [employeeMessage, setEmployeeMessage] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)

  async function loadEmployees(): Promise<void> {
    const rows = await window.api.employees.list()
    setEmployees(rows)
  }

  async function saveEmployee(): Promise<void> {
    setEmployeeMessage('')


    if (!employeeName.trim()) {
      setEmployeeMessage('اكتب اسم الموظف')
      return
    }

    const cleanNationalId = nationalId.trim()

    if (!/^\d{14}$/.test(cleanNationalId)) {
      setEmployeeMessage('الرقم القومي لازم يكون 14 رقم بالظبط')
      return
    }

    try {
      setIsSavingEmployee(true)

    if (editingEmployeeId) {
      await window.api.employees.update({
        id: editingEmployeeId,
        name: employeeName,
        national_id: cleanNationalId,
        qualification,
        job_title: jobTitle,
        department_id: employeeDepartmentId ? Number(employeeDepartmentId) : null,
        notes: employeeNotes,
        active: employeeActive
      })

      setEmployeeMessage('تم تعديل بيانات الموظف بنجاح')
    } else {
      await window.api.employees.create({
        name: employeeName,
        national_id: cleanNationalId,
        qualification,
        job_title: jobTitle,
        department_id: employeeDepartmentId ? Number(employeeDepartmentId) : null,
        notes: employeeNotes,
        active: employeeActive
      })

      setEmployeeMessage('تم حفظ الموظف بنجاح')
    }

    resetEmployeeForm()
    await loadEmployees()

      setEmployeeName('')
      setNationalId('')
      setQualification('')
      setJobTitle('')
      setEmployeeDepartmentId('')
      setEmployeeNotes('')
      setEmployeeActive(true)
      setEmployeeMessage('تم حفظ الموظف بنجاح')

      await loadEmployees()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الموظف'
      setEmployeeMessage(errorMessage)
    } finally {
      setIsSavingEmployee(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    const searchText = employeeSearch.trim().toLowerCase()

    return employees.filter((employee) => {
      const matchesSearch =
        !searchText ||
        employee.name.toLowerCase().includes(searchText) ||
        (employee.national_id || '').toLowerCase().includes(searchText)

      const matchesDepartment =
        !employeeDepartmentFilter || String(employee.department_id || '') === employeeDepartmentFilter

      return matchesSearch && matchesDepartment
    })
  }, [employees, employeeSearch, employeeDepartmentFilter])

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
          setEmployeeMessage('حدث خطأ أثناء تحميل بيانات الموظفين')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  function resetEmployeeForm(): void {
    setEditingEmployeeId(null)
    setEmployeeName('')
    setNationalId('')
    setQualification('')
    setJobTitle('')
    setEmployeeDepartmentId('')
    setEmployeeNotes('')
    setEmployeeActive(true)
  }

  function startEditEmployee(employee: Employee): void {
    setEditingEmployeeId(employee.id)
    setEmployeeName(employee.name)
    setNationalId(employee.national_id || '')
    setQualification(employee.qualification || '')
    setJobTitle(employee.job_title || '')
    setEmployeeDepartmentId(employee.department_id ? String(employee.department_id) : '')
    setEmployeeNotes(employee.notes || '')
    setEmployeeActive(Boolean(employee.active))
    setEmployeeMessage('تعديل بيانات الموظف')
  }

  async function toggleEmployeeActive(employee: Employee): Promise<void> {
    const nextActive = !employee.active

    await window.api.employees.setActive({
      id: employee.id,
      active: nextActive
    })

    await loadEmployees()
  }

  return (
    <>
      <section className="card">
        <h2>إضافة موظف</h2>

        <div className="form-grid">

          <label>
            اسم الموظف
            <input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} />
          </label>

          <label>
            الرقم القومي
            <input
              value={nationalId}
              inputMode="numeric"
              maxLength={14}
              onChange={(event) => {
                const onlyNumbers = event.target.value.replace(/\D/g, '').slice(0, 14)
                setNationalId(onlyNumbers)
              }}
            />
          </label>

          <label>
            المؤهل
            <input value={qualification} onChange={(event) => setQualification(event.target.value)} />
          </label>

          <label>
            الوظيفة
            <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          </label>

          <label>
            الإدارة
            <select
              value={employeeDepartmentId}
              onChange={(event) => setEmployeeDepartmentId(event.target.value)}
            >
              <option value="">بدون إدارة</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            ملاحظات
            <input value={employeeNotes} onChange={(event) => setEmployeeNotes(event.target.value)} />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={employeeActive}
              onChange={(event) => setEmployeeActive(event.target.checked)}
            />
            موظف نشط
          </label>
        </div>

        <button className="primary-button" disabled={isSavingEmployee} onClick={saveEmployee}>
          {isSavingEmployee ? 'جاري الحفظ...' : editingEmployeeId ? 'تعديل الموظف' : 'حفظ الموظف'}
        </button>

        {editingEmployeeId && (
          <button className="secondary-button" type="button" onClick={resetEmployeeForm}>
            إلغاء التعديل
          </button>
        )}

        {employeeMessage && <p className="message">{employeeMessage}</p>}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>قائمة الموظفين</h2>
          <span>عدد النتائج: {filteredEmployees.length}</span>
        </div>

        <div className="form-grid">
          <label>
              بحث بالاسم أو الرقم القومي 
            <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} />
          </label>

          <label>
            فلتر الإدارة
            <select
              value={employeeDepartmentFilter}
              onChange={(event) => setEmployeeDepartmentFilter(event.target.value)}
            >
              <option value="">كل الإدارات</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table>
          <thead>
            <tr>              
              <th>الاسم</th>
              <th>الرقم القومي</th>
              <th>المؤهل</th>
              <th>الوظيفة</th>
              <th>الإدارة</th>
              <th>الحالة</th>
              <th>ملاحظات</th>
              <th>إجراءات</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8}>لا توجد موظفين مطابقين للبحث</td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.national_id || '-'}</td>
                  <td>{employee.qualification || '-'}</td>
                  <td>{employee.job_title || '-'}</td>
                  <td>{employee.department_name || '-'}</td>
                  <td>{employee.active ? 'نشط' : 'غير نشط'}</td>
                  <td>{employee.notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="small-button" onClick={() => startEditEmployee(employee)}>
                        تعديل
                      </button>

                      <button className="small-button danger" onClick={() => toggleEmployeeActive(employee)}>
                        {employee.active ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}