import { getDb } from '../db'
import type { MutationResult } from '../../types/common'
import type {
  CreateDepartmentInput,
  DeleteDepartmentInput,
  DepartmentRow,
  ListDepartmentsInput,
  SetDepartmentActiveInput,
  UpdateDepartmentInput
} from '../../types/departments'
import type Database from 'better-sqlite3'


function validateParentDepartment(
  db: Database.Database,
  departmentId: number | null,
  parentId: number | null
): void {
  if (parentId === null) {
    return
  }

  const parent = db.prepare(`SELECT id FROM departments WHERE id = ? LIMIT 1`).get(parentId) as
    | { id: number }
    | undefined

  if (!parent) {
    throw new Error('الإدارة الرئيسية غير موجودة')
  }

  if (departmentId && parentId === departmentId) {
    throw new Error('الإدارة لا يمكن أن تكون تابعة لنفسها')
  }

  if (!departmentId) {
    return
  }

  const invalidParent = db
    .prepare(
      `
      WITH RECURSIVE children(id) AS (
        SELECT id
        FROM departments
        WHERE parent_id = @departmentId

        UNION

        SELECT d.id
        FROM departments d
        INNER JOIN children c ON c.id = d.parent_id
      )
      SELECT id
      FROM children
      WHERE id = @parentId
      LIMIT 1
    `
    )
    .get({
      departmentId,
      parentId
    }) as { id: number } | undefined

  if (invalidParent) {
    throw new Error('لا يمكن اختيار إدارة تابعة كإدارة رئيسية')
  }
}

export function listDepartments(input: ListDepartmentsInput = {}): DepartmentRow[] {
  const db = getDb()

  return db
    .prepare(
      `
      SELECT
        d.id,
        d.name,
        d.parent_id,
        p.name AS parent_name,
        d.notes,
        d.active,
        d.created_at,
        d.updated_at
      FROM departments d
      LEFT JOIN departments p ON p.id = d.parent_id
      WHERE (@includeInactive = 1 OR d.active = 1)
      ORDER BY d.id ASC
    `
    )
    .all({
      includeInactive: input.includeInactive ? 1 : 0
    }) as DepartmentRow[]
}

export function createDepartment(input: CreateDepartmentInput): MutationResult {
  const name = input.name.trim()

  if (!name) {
    throw new Error('اسم الإدارة مطلوب')
  }

  const db = getDb()
  validateParentDepartment(db, null, input.parent_id)

  try {
    db.prepare(
      `
      INSERT INTO departments (name, parent_id, notes, active)
      VALUES (@name, @parent_id, @notes, @active)
    `
    ).run({
      name,
      parent_id: input.parent_id,
      notes: input.notes.trim(),
      active: input.active ? 1 : 0
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new Error('اسم الإدارة موجود قبل كده')
    }

    throw error
  }

  return { success: true }
}

export function updateDepartment(input: UpdateDepartmentInput): MutationResult {
  const id = Number(input.id)
  const name = input.name.trim()

  if (!id) {
    throw new Error('الإدارة غير صحيحة')
  }

  if (!name) {
    throw new Error('اسم الإدارة مطلوب')
  }

  const db = getDb()
  validateParentDepartment(db, id, input.parent_id)

  const existingName = db
    .prepare(
      `
      SELECT id
      FROM departments
      WHERE name = ?
        AND id <> ?
      LIMIT 1
    `
    )
    .get(name, id) as { id: number } | undefined

  if (existingName) {
    throw new Error('اسم الإدارة موجود قبل كده')
  }

  const result = db
    .prepare(
      `
      UPDATE departments
      SET
        name = @name,
        parent_id = @parent_id,
        notes = @notes,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `
    )
    .run({
      id,
      name,
      parent_id: input.parent_id,
      notes: input.notes.trim(),
      active: input.active ? 1 : 0
    })

  if (result.changes === 0) {
    throw new Error('الإدارة غير موجودة')
  }

  return { success: true }
}

export function setDepartmentActive(input: SetDepartmentActiveInput): MutationResult {
  const id = Number(input.id)

  if (!id) {
    throw new Error('الإدارة غير صحيحة')
  }

  const db = getDb()

  const result = db
    .prepare(
      `
      UPDATE departments
      SET
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `
    )
    .run({
      id,
      active: input.active ? 1 : 0
    })

  if (result.changes === 0) {
    throw new Error('الإدارة غير موجودة')
  }

  return { success: true }
}

export function deleteDepartment(input: DeleteDepartmentInput): MutationResult {
  const id = Number(input.id)

  if (!id) {
    throw new Error('الإدارة غير صحيحة')
  }

  const db = getDb()

  const employeesCount = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM employees
      WHERE department_id = ?
    `
    )
    .get(id) as { count: number }

  if (employeesCount.count > 0) {
    throw new Error('لا يمكن حذف الإدارة لأنها مرتبطة بموظفين')
  }

  const childrenCount = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM departments
      WHERE parent_id = ?
    `
    )
    .get(id) as { count: number }

  if (childrenCount.count > 0) {
    throw new Error('لا يمكن حذف الإدارة لأنها تحتوي على إدارات تابعة')
  }

  const result = db.prepare(`DELETE FROM departments WHERE id = ?`).run(id)

  if (result.changes === 0) {
    throw new Error('الإدارة غير موجودة')
  }

  return { success: true }
}