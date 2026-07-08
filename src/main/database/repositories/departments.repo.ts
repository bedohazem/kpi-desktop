import { getDb } from '../db'
import type { MutationResult } from '../../types/common'
import type { CreateDepartmentInput, DepartmentRow } from '../../types/departments'

export function listDepartments(): DepartmentRow[] {
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
      ORDER BY d.name
    `
    )
    .all() as DepartmentRow[]
}

export function createDepartment(input: CreateDepartmentInput): MutationResult {
  const name = input.name.trim()

  if (!name) {
    throw new Error('اسم الإدارة مطلوب')
  }

  const db = getDb()

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