import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import type { Department, Employee } from '../../types/api'
import { toast } from '../../utils/toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import {
  flattenDepartmentTree,
  getDepartmentAndDescendantIds,
  sortEmployeeListByDepartmentTree
} from '../../utils/departments-tree'

export default function EmployeesPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [employeeName, setEmployeeName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [qualification, setQualification] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employeeSortOrder, setEmployeeSortOrder] = useState('')
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('')
  const [employeeNotes, setEmployeeNotes] = useState('')
  const [employeeActive, setEmployeeActive] = useState(true)

  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('')
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false)

  const employeeFormRef = useRef<HTMLElement | null>(null)
  const employeeNameInputRef = useRef<HTMLInputElement | null>(null)

  const departmentOptions = useMemo(() => flattenDepartmentTree(departments), [departments])

  const selectedEmployeeDepartmentIds = useMemo(() => {
    if (!employeeDepartmentFilter) {
      return null
    }

    return new Set(getDepartmentAndDescendantIds(departments, Number(employeeDepartmentFilter)))
  }, [departments, employeeDepartmentFilter])

  async function loadEmployees(): Promise<void> {
    const rows = await window.api.employees.list({
      includeInactive: showInactiveEmployees
    })

    setEmployees(rows)
  }

  async function saveEmployee(): Promise<void> {
    if (!employeeName.trim()) {
      toast.error('اكتب اسم الموظف')
      return
    }

    const cleanNationalId = nationalId.trim()

    if (!/^\d{14}$/.test(cleanNationalId)) {
      toast.error('الرقم القومي لازم يكون 14 رقم بالظبط')
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
          sort_order: employeeSortOrder
            ? Number(employeeSortOrder)
            : 0,
          notes: employeeNotes,
          active: employeeActive
        })

        toast.success('تم تعديل بيانات الموظف بنجاح')
      } else {
        await window.api.employees.create({
          name: employeeName,
          national_id: cleanNationalId,
          qualification,
          job_title: jobTitle,
          department_id: employeeDepartmentId ? Number(employeeDepartmentId) : null,
          sort_order: employeeSortOrder
            ? Number(employeeSortOrder)
            : 0,
          notes: employeeNotes,
          active: employeeActive
        })

        toast.success('تم حفظ الموظف بنجاح')
      }

      resetEmployeeForm()
      await loadEmployees()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الموظف'
      toast.error(errorMessage)
    } finally {
      setIsSavingEmployee(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    const searchText = employeeSearch.trim().toLowerCase()

    const matchingEmployees = employees.filter((employee) => {
      const matchesSearch =
        !searchText ||
        employee.name.toLowerCase().includes(searchText) ||
        (employee.national_id || '')
          .toLowerCase()
          .includes(searchText)

      const matchesDepartment =
        !selectedEmployeeDepartmentIds ||
        (employee.department_id !== null &&
          selectedEmployeeDepartmentIds.has(employee.department_id))

      return matchesSearch && matchesDepartment
    })

    return sortEmployeeListByDepartmentTree(
      matchingEmployees,
      departments
    )
  }, [
    employees,
    departments,
    employeeSearch,
    selectedEmployeeDepartmentIds
  ])

  useEffect(() => {
    let isMounted = true

    Promise.all([
      window.api.departments.list(),
      window.api.employees.list({
        includeInactive: showInactiveEmployees
      })
    ])
      .then(([departmentRows, employeeRows]) => {
        if (isMounted) {
          setDepartments(departmentRows)
          setEmployees(employeeRows)
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل بيانات الموظفين')
        }
      })

    return () => {
      isMounted = false
    }
  }, [showInactiveEmployees])

  function resetEmployeeForm(): void {
    setEditingEmployeeId(null)
    setEmployeeName('')
    setNationalId('')
    setQualification('')
    setJobTitle('')
    setEmployeeDepartmentId('')
    setEmployeeNotes('')
    setEmployeeActive(true)
    setEmployeeSortOrder('')
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
    setEmployeeSortOrder(
      employee.sort_order > 0
        ? String(employee.sort_order)
        : ''
    )
   toast.info('تعديل بيانات الموظف')

    requestAnimationFrame(() => {
      employeeFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })

      window.setTimeout(() => {
        employeeNameInputRef.current?.focus()
        employeeNameInputRef.current?.select()
      }, 350)
    })
  }

  async function toggleEmployeeActive(employee: Employee): Promise<void> {
    const nextActive = !employee.active

    try {
      await window.api.employees.setActive({
        id: employee.id,
        active: nextActive
      })

      toast.success(nextActive ? 'تم تفعيل الموظف' : 'تم تعطيل الموظف')
      await loadEmployees()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تغيير حالة الموظف'
      toast.error(errorMessage)
    }
  }


  async function confirmDeleteEmployee(): Promise<void> {
    if (!employeeToDelete) {
      return
    }

    try {
      await window.api.employees.delete({
        id: employeeToDelete.id
      })

      toast.success('تم حذف الموظف بنجاح')

      if (editingEmployeeId === employeeToDelete.id) {
        resetEmployeeForm()
      }

      setEmployeeToDelete(null)
      await loadEmployees()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حذف الموظف'
      toast.error(errorMessage)
    }
  }

  return (
    <>
      <section ref={employeeFormRef} className="card">
        <h2>{editingEmployeeId ? 'تعديل بيانات الموظف' : 'إضافة موظف'}</h2>

        <div className="form-grid">

          <label>
            اسم الموظف
            <input
              ref={employeeNameInputRef}
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
            <input value={qualification} onChange={(event) => setQualification(event.target.value)} />
          </label>

          <label>
            الوظيفة
            <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          </label>

          <label>
            الترتيب داخل الإدارة
            <input
              value={employeeSortOrder}
              inputMode="numeric"
              placeholder="1 للمدير، 2 للنائب..."
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '')
                setEmployeeSortOrder(value)
              }}
            />
          </label>

          <label>
            الإدارة
            <select
              value={employeeDepartmentId}
              onChange={(event) => setEmployeeDepartmentId(event.target.value)}
            >
              <option value="">بدون إدارة</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {'— '.repeat(department.level)}
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

        <label className="checkbox-label inline-checkbox">
          <input
            type="checkbox"
            checked={showInactiveEmployees}
            onChange={(event) => setShowInactiveEmployees(event.target.checked)}
          />
          إظهار غير المفعلين
        </label>

        <table>
          <thead>
            <tr>              
              <th>الاسم</th>
              <th>الرقم القومي</th>
              <th>المؤهل</th>
              <th>الوظيفة</th>
              <th>الإدارة</th>
              <th>الترتيب</th>
              <th>الحالة</th>
              <th>ملاحظات</th>
              <th>إجراءات</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9}>لا توجد موظفين مطابقين للبحث</td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.national_id || '-'}</td>
                  <td>{employee.qualification || '-'}</td>
                  <td>{employee.job_title || '-'}</td>
                  <td>{employee.department_name || '-'}</td>
                  <td>
                    {employee.sort_order > 0
                      ? employee.sort_order
                      : '-'}
                  </td>
                  <td>{employee.active ? 'نشط' : 'غير نشط'}</td>
                  <td>{employee.notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="small-button" onClick={() => startEditEmployee(employee)}>
                        تعديل
                      </button>

                      <button
                        className={employee.active ? 'small-button danger' : 'small-button success'}
                        onClick={() => toggleEmployeeActive(employee)}
                      >
                        {employee.active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button className="small-button danger" onClick={() => setEmployeeToDelete(employee)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={Boolean(employeeToDelete)}
        title="حذف موظف"
        message={`هل تريد حذف الموظف "${employeeToDelete?.name || ''}" نهائيًا؟ سيتم حذف تقييماته القديمة أيضًا.`}
        confirmText="حذف نهائي"
        cancelText="إلغاء"
        danger
        onConfirm={() => {
          void confirmDeleteEmployee()
        }}
        onCancel={() => setEmployeeToDelete(null)}
      />
    </>
  )
}