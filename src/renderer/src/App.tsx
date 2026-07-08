import { useEffect, useState, type ReactElement } from 'react'

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

type CreateDepartmentInput = {
  name: string
  parent_id: number | null
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
}

declare global {
  interface Window {
    api: AppApi
  }
}

function App(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([])
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function loadDepartments(): Promise<void> {
    const rows = await window.api.departments.list()
    setDepartments(rows)
  }

  async function saveDepartment(): Promise<void> {
    setMessage('')

    if (!name.trim()) {
      setMessage('اكتب اسم الإدارة')
      return
    }

    try {
      setIsSaving(true)

      await window.api.departments.create({
        name,
        parent_id: parentId ? Number(parentId) : null,
        notes,
        active: true
      })

      setName('')
      setParentId('')
      setNotes('')
      setMessage('تم حفظ الإدارة بنجاح')

      await loadDepartments()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الإدارة'
      setMessage(errorMessage)
    } finally {
      setIsSaving(false)
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
          setMessage('حدث خطأ أثناء تحميل الإدارات')
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
        <section className="card">
          <h2>إضافة إدارة</h2>

          <div className="form-grid">
            <label>
              اسم الإدارة
              <input value={name} onChange={(event) => setName(event.target.value)} />
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
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          <button className="primary-button" disabled={isSaving} onClick={saveDepartment}>
            {isSaving ? 'جاري الحفظ...' : 'حفظ الإدارة'}
          </button>

          {message && <p className="message">{message}</p>}
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
      </main>
    </div>
  )
}

export default App
