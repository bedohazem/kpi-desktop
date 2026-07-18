import { useEffect, useMemo, useState, type ReactElement } from 'react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import type { Department } from '../../types/api'
import { toast } from '../../utils/toast'
import {
  flattenDepartmentTree,
  getDepartmentAndDescendantIds
} from '../../utils/departments-tree'


export default function DepartmentsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])

  const [departmentName, setDepartmentName] = useState('')
  const [parentId, setParentId] = useState('')
  const [departmentNotes, setDepartmentNotes] = useState('')
  const [departmentActive, setDepartmentActive] = useState(true)

  const [isSavingDepartment, setIsSavingDepartment] = useState(false)
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null)
  const [showInactiveDepartments, setShowInactiveDepartments] = useState(false)
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null)

  const departmentTreeRows = useMemo(() => flattenDepartmentTree(departments), [departments])

  const blockedParentIds = useMemo(() => {
    if (!editingDepartmentId) {
      return new Set<number>()
    }

    return new Set(getDepartmentAndDescendantIds(departments, editingDepartmentId))
  }, [departments, editingDepartmentId])

  const parentDepartmentOptions = useMemo(() => {
    return departmentTreeRows.filter((department) => !blockedParentIds.has(department.id))
  }, [departmentTreeRows, blockedParentIds])

  async function loadDepartments(): Promise<void> {
    const rows = await window.api.departments.list({
      includeInactive: showInactiveDepartments
    })

    setDepartments(rows)
  }

  function resetDepartmentForm(): void {
    setEditingDepartmentId(null)
    setDepartmentName('')
    setParentId('')
    setDepartmentNotes('')
    setDepartmentActive(true)
  }

  function startEditDepartment(department: Department): void {
    setEditingDepartmentId(department.id)
    setDepartmentName(department.name)
    setParentId(department.parent_id ? String(department.parent_id) : '')
    setDepartmentNotes(department.notes || '')
    setDepartmentActive(Boolean(department.active))
    toast.info('تعديل بيانات الإدارة')
  }

  async function saveDepartment(): Promise<void> {
    if (!departmentName.trim()) {
      toast.warning('اكتب اسم الإدارة')
      return
    }

    try {
      setIsSavingDepartment(true)

      if (editingDepartmentId) {
        await window.api.departments.update({
          id: editingDepartmentId,
          name: departmentName,
          parent_id: parentId ? Number(parentId) : null,
          notes: departmentNotes,
          active: departmentActive
        })

        toast.success('تم تعديل الإدارة بنجاح')
      } else {
        await window.api.departments.create({
          name: departmentName,
          parent_id: parentId ? Number(parentId) : null,
          notes: departmentNotes,
          active: departmentActive
        })

        toast.success('تم حفظ الإدارة بنجاح')
      }

      resetDepartmentForm()
      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الإدارة'
      toast.error(errorMessage)
    } finally {
      setIsSavingDepartment(false)
    }
  }

  async function toggleDepartmentActive(department: Department): Promise<void> {
    const nextActive = !department.active

    try {
      await window.api.departments.setActive({
        id: department.id,
        active: nextActive
      })

      toast.success(nextActive ? 'تم تفعيل الإدارة' : 'تم تعطيل الإدارة')
      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تغيير حالة الإدارة'
      toast.error(errorMessage)
    }
  }

  async function confirmDeleteDepartment(): Promise<void> {
    if (!departmentToDelete) {
      return
    }

    try {
      await window.api.departments.delete({
        id: departmentToDelete.id
      })

      toast.success('تم حذف الإدارة بنجاح')

      if (editingDepartmentId === departmentToDelete.id) {
        resetDepartmentForm()
      }

      setDepartmentToDelete(null)
      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حذف الإدارة'
      toast.error(errorMessage)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.api.departments
      .list({
        includeInactive: showInactiveDepartments
      })
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
  }, [showInactiveDepartments])

  return (
    <>
      <section className="card sticky-entry-card">
        <h2>{editingDepartmentId ? 'تعديل إدارة' : 'إضافة إدارة'}</h2>

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
                {parentDepartmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {'— '.repeat(department.level)}
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

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={departmentActive}
              onChange={(event) => setDepartmentActive(event.target.checked)}
            />
            إدارة نشطة
          </label>
        </div>

        <div className="actions-row">
          <button className="primary-button" disabled={isSavingDepartment} onClick={saveDepartment}>
            {isSavingDepartment
              ? 'جاري الحفظ...'
              : editingDepartmentId
                ? 'تعديل الإدارة'
                : 'حفظ الإدارة'}
          </button>

          {editingDepartmentId && (
            <button className="secondary-button" type="button" onClick={resetDepartmentForm}>
              إلغاء التعديل
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>قائمة الإدارات</h2>
          <span>عدد الإدارات: {departments.length}</span>
        </div>

        <label className="checkbox-label inline-checkbox">
          <input
            type="checkbox"
            checked={showInactiveDepartments}
            onChange={(event) => setShowInactiveDepartments(event.target.checked)}
          />
          إظهار غير النشطة
        </label>

        <table>
          <thead>
            <tr>
              <th>الإدارة</th>
              <th>تابعة لـ</th>
              <th>ملاحظات</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>

          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={5}>لا توجد إدارات حتى الآن</td>
              </tr>
            ) : (
              departmentTreeRows.map((department) => (
                <tr key={department.id}>
                  <td>
                    <span
                      className="department-tree-name"
                      style={{ paddingInlineStart: `${department.level * 22}px` }}
                    >
                      <span className="department-tree-branch">{department.level === 0 ? '●' : '↳'}</span>
                      {department.name}
                    </span>
                  </td>
                  <td>{department.parent_name || '-'}</td>
                  <td>{department.notes || '-'}</td>
                  <td>{department.active ? 'نشطة' : 'غير نشطة'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="small-button" onClick={() => startEditDepartment(department)}>
                        تعديل
                      </button>

                      <button
                        className={department.active ? 'small-button danger' : 'small-button success'}
                        onClick={() => toggleDepartmentActive(department)}
                      >
                        {department.active ? 'تعطيل' : 'تفعيل'}
                      </button>

                      <button
                        className="small-button danger"
                        onClick={() => setDepartmentToDelete(department)}
                      >
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
        open={Boolean(departmentToDelete)}
        title="حذف إدارة"
        message={`هل تريد حذف الإدارة "${departmentToDelete?.name || ''}" نهائيًا؟`}
        confirmText="حذف نهائي"
        cancelText="إلغاء"
        danger
        onConfirm={() => {
          void confirmDeleteDepartment()
        }}
        onCancel={() => setDepartmentToDelete(null)}
      />
    </>
  )
}