import { useEffect, useMemo, useState, type ReactElement } from 'react'

type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

type Department = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

type Employee = {
  id: number
  employee_number: string | null
  name: string
  national_id: string | null
  qualification: string | null
  job_title: string | null
  department_id: number | null
  department_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  notes: string
  active: boolean
}

type CreateEmployeeInput = {
  employee_number: string
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
  notes: string
  active: boolean
}

type MutationResult = {
  success: boolean
}

type AppApi = {
  dbTest: () => Promise<DbTestResult>
  departments: {
    list: () => Promise<Department[]>
    create: (data: CreateDepartmentInput) => Promise<MutationResult>
  }
  employees: {
    list: () => Promise<Employee[]>
    create: (data: CreateEmployeeInput) => Promise<MutationResult>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}

function App(): ReactElement {
  const [activePage, setActivePage] = useState<'departments' | 'employees'>('departments')

  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentName, setDepartmentName] = useState('')
  const [parentId, setParentId] = useState('')
  const [departmentNotes, setDepartmentNotes] = useState('')
  const [isSavingDepartment, setIsSavingDepartment] = useState(false)
  const [departmentMessage, setDepartmentMessage] = useState('')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeNumber, setEmployeeNumber] = useState('')
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

  async function loadDepartments(): Promise<void> {
    const rows = await window.api.departments.list()
    setDepartments(rows)
  }

  async function loadEmployees(): Promise<void> {
    const rows = await window.api.employees.list()
    setEmployees(rows)
  }

  async function saveDepartment(): Promise<void> {
    setDepartmentMessage('')

    if (!departmentName.trim()) {
      setDepartmentMessage('اكتب اسم الإدارة')
      return
    }

    try {
      setIsSavingDepartment(true)

      await window.api.departments.create({
        name: departmentName,
        parent_id: parentId ? Number(parentId) : null,
        notes: departmentNotes,
        active: true
      })

      setDepartmentName('')
      setParentId('')
      setDepartmentNotes('')
      setDepartmentMessage('تم حفظ الإدارة بنجاح')

      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الإدارة'
      setDepartmentMessage(errorMessage)
    } finally {
      setIsSavingDepartment(false)
    }
  }

  async function saveEmployee(): Promise<void> {
    setEmployeeMessage('')

    if (!employeeNumber.trim()) {
      setEmployeeMessage('اكتب رقم الموظف')
      return
    }

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

      await window.api.employees.create({
        employee_number: employeeNumber,
        name: employeeName,
        national_id: cleanNationalId,
        qualification,
        job_title: jobTitle,
        department_id: employeeDepartmentId ? Number(employeeDepartmentId) : null,
        notes: employeeNotes,
        active: employeeActive
      })

      setEmployeeNumber('')
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
        (employee.employee_number || '').toLowerCase().includes(searchText) ||
        (employee.national_id || '').toLowerCase().includes(searchText)

      const matchesDepartment =
        !employeeDepartmentFilter ||
        String(employee.department_id || '') === employeeDepartmentFilter

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
          setDepartmentMessage('حدث خطأ أثناء تحميل البيانات')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>برنامج التقييمات الشهرية</h1>
        <p>إدارة الإدارات والموظفين والتقييمات الشهرية</p>
      </header>

      <main className="page">
        <nav className="tabs">
          <button
            className={activePage === 'departments' ? 'tab active' : 'tab'}
            onClick={() => setActivePage('departments')}
          >
            الإدارات
          </button>

          <button
            className={activePage === 'employees' ? 'tab active' : 'tab'}
            onClick={() => setActivePage('employees')}
          >
            الموظفين
          </button>
        </nav>

        {activePage === 'departments' && (
          <>
            <section className="card">
              <h2>إضافة إدارة</h2>

              <div className="form-grid">
                <label>
                  اسم الإدارة
                  <input
                    value={departmentName}
                    onChange={(event) => setDepartmentName(event.target.value)}
                  />
                </label>

                <label>
                  تابعة لـ
                  <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
                    <option value="">بدون إدارة رئيسية</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  ملاحظات
                  <input
                    value={departmentNotes}
                    onChange={(event) => setDepartmentNotes(event.target.value)}
                  />
                </label>
              </div>

              <button
                className="primary-button"
                disabled={isSavingDepartment}
                onClick={saveDepartment}
              >
                {isSavingDepartment ? 'جاري الحفظ...' : 'حفظ الإدارة'}
              </button>

              {departmentMessage && <p className="message">{departmentMessage}</p>}
            </section>

            <section className="card">
              <h2>قائمة الإدارات</h2>

              <table>
                <thead>
                  <tr>
                    <th>الإدارة</th>
                    <th>تابعة لـ</th>
                    <th>ملاحظات</th>
                    <th>الحالة</th>
                  </tr>
                </thead>

                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={4}>لا توجد إدارات حتى الآن</td>
                    </tr>
                  ) : (
                    departments.map((department) => (
                      <tr key={department.id}>
                        <td>{department.name}</td>
                        <td>{department.parent_name || '-'}</td>
                        <td>{department.notes || '-'}</td>
                        <td>{department.active ? 'نشطة' : 'غير نشطة'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}

        {activePage === 'employees' && (
          <>
            <section className="card">
              <h2>إضافة موظف</h2>

              <div className="form-grid">
                <label>
                  رقم الموظف
                  <input
                    value={employeeNumber}
                    onChange={(event) => setEmployeeNumber(event.target.value)}
                  />
                </label>

                <label>
                  اسم الموظف
                  <input
                    value={employeeName}
                    onChange={(event) => setEmployeeName(event.target.value)}
                  />
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
                  <input
                    value={qualification}
                    onChange={(event) => setQualification(event.target.value)}
                  />
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
                  <input
                    value={employeeNotes}
                    onChange={(event) => setEmployeeNotes(event.target.value)}
                  />
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
                {isSavingEmployee ? 'جاري الحفظ...' : 'حفظ الموظف'}
              </button>

              {employeeMessage && <p className="message">{employeeMessage}</p>}
            </section>

            <section className="card">
              <div className="section-header">
                <h2>قائمة الموظفين</h2>
                <span>عدد النتائج: {filteredEmployees.length}</span>
              </div>

              <div className="form-grid">
                <label>
                  بحث بالاسم أو رقم الموظف أو الرقم القومي
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                  />
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
                    <th>رقم الموظف</th>
                    <th>الاسم</th>
                    <th>الرقم القومي</th>
                    <th>المؤهل</th>
                    <th>الوظيفة</th>
                    <th>الإدارة</th>
                    <th>الحالة</th>
                    <th>ملاحظات</th>
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
                        <td>{employee.employee_number || '-'}</td>
                        <td>{employee.name}</td>
                        <td>{employee.national_id || '-'}</td>
                        <td>{employee.qualification || '-'}</td>
                        <td>{employee.job_title || '-'}</td>
                        <td>{employee.department_name || '-'}</td>
                        <td>{employee.active ? 'نشط' : 'غير نشط'}</td>
                        <td>{employee.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
