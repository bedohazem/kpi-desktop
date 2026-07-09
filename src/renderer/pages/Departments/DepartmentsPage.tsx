import { useEffect, useState, type ReactElement } from 'react'
import type { Department } from '../../types/api'
import { toast } from '../../utils/toast'

export default function DepartmentsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentName, setDepartmentName] = useState('')
  const [parentId, setParentId] = useState('')
  const [departmentNotes, setDepartmentNotes] = useState('')
  const [isSavingDepartment, setIsSavingDepartment] = useState(false)

  async function loadDepartments(): Promise<void> {
    const rows = await window.api.departments.list()
    setDepartments(rows)
  }

  async function saveDepartment(): Promise<void> {
    toast.info('جاري حفظ الإدارة...')

    if (!departmentName.trim()) {
      toast.warning('اكتب اسم الإدارة')
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
      toast.success('تم حفظ الإدارة بنجاح')

      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الإدارة'
      toast.error(errorMessage)
    } finally {
      setIsSavingDepartment(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.api.departments
      .list()
      .then((rows) => {
        if (isMounted) {
          setDepartments(rows)
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

        <button className="primary-button" disabled={isSavingDepartment} onClick={saveDepartment}>
          {isSavingDepartment ? 'جاري الحفظ...' : 'حفظ الإدارة'}
        </button>

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
  )
}