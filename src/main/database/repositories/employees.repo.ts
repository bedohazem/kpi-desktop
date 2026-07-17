import { getDb } from '../db'
import type { MutationResult } from '../../types/common'
import type {
  CreateEmployeeInput,
  DeleteEmployeeInput,
  EmployeeRow,
  ListEmployeesInput,
  SetEmployeeActiveInput,
  UpdateEmployeeInput
} from '../../types/employees'

export function listEmployees(input: ListEmployeesInput = {}): EmployeeRow[] {
  const db = getDb()

  return db
    .prepare(
      `
      SELECT
        e.id,
        e.name,
        e.national_id,
        e.qualification,
        e.job_title,
        e.department_id,
        e.sort_order,
        d.name AS department_name,
        e.notes,
        e.active,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE (@includeInactive = 1 OR e.active = 1)
      ORDER BY
        CASE WHEN e.sort_order > 0 THEN 0 ELSE 1 END,
        e.sort_order ASC,
        e.name COLLATE NOCASE ASC,
        e.id ASC
    `
    )
    .all({
      includeInactive: input.includeInactive ? 1 : 0
    }) as EmployeeRow[]
}

export function createEmployee(input: CreateEmployeeInput): MutationResult {
  const name = input.name.trim()
  const nationalId = input.national_id.trim()

  const sortOrder = Number(input.sort_order)

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error('الترتيب داخل الإدارة غير صحيح')
  }

  if (!name) {
    throw new Error('اسم الموظف مطلوب')
  }

  if (!/^\d{14}$/.test(nationalId)) {
    throw new Error('الرقم القومي لازم يكون 14 رقم بالظبط')
  }

  const db = getDb()

  const existingNationalId = db
    .prepare(
      `
      SELECT id
      FROM employees
      WHERE national_id = ?
      LIMIT 1
    `
    )
    .get(nationalId) as { id: number } | undefined

  if (existingNationalId) {
    throw new Error('الرقم القومي مسجل لموظف آخر')
  }

  try {
    db.prepare(
      `
      INSERT INTO employees (
        name,
        national_id,
        qualification,
        job_title,
        department_id,
        sort_order,
        notes,
        active
      )
      VALUES (
        @name,
        @national_id,
        @qualification,
        @job_title,
        @department_id,
        @sort_order,
        @notes,
        @active
      )
    `
    ).run({
      name,
      national_id: nationalId,
      qualification: input.qualification.trim(),
      job_title: input.job_title.trim(),
      department_id: input.department_id,
      sort_order: sortOrder,
      notes: input.notes.trim(),
      active: input.active ? 1 : 0
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new Error('الرقم القومي أو بيانات الموظف مسجلة قبل كده')
    }

    throw error
  }

  return { success: true }
}

export function updateEmployee(input: UpdateEmployeeInput): MutationResult {
  const id = Number(input.id)
  const name = input.name.trim()
  const nationalId = input.national_id.trim()

  const sortOrder = Number(input.sort_order)

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error('الترتيب داخل الإدارة غير صحيح')
  }

  if (!id) {
    throw new Error('الموظف غير صحيح')
  }

  if (!name) {
    throw new Error('اسم الموظف مطلوب')
  }

  if (!/^\d{14}$/.test(nationalId)) {
    throw new Error('الرقم القومي لازم يكون 14 رقم بالظبط')
  }

  const db = getDb()

  const existingNationalId = db
    .prepare(
      `
      SELECT id
      FROM employees
      WHERE national_id = ?
        AND id <> ?
      LIMIT 1
    `
    )
    .get(nationalId, id) as { id: number } | undefined

  if (existingNationalId) {
    throw new Error('الرقم القومي مسجل لموظف آخر')
  }

  const result = db
    .prepare(
      `
      UPDATE employees
      SET
        name = @name,
        national_id = @national_id,
        qualification = @qualification,
        job_title = @job_title,
        department_id = @department_id,
        sort_order = @sort_order,
        notes = @notes,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `
    )
    .run({
      id,
      name,
      national_id: nationalId,
      qualification: input.qualification.trim(),
      job_title: input.job_title.trim(),
      department_id: input.department_id,
      sort_order: sortOrder,
      notes: input.notes.trim(),
      active: input.active ? 1 : 0
    })

  if (result.changes === 0) {
    throw new Error('الموظف غير موجود')
  }

  return { success: true }
}

export function setEmployeeActive(input: SetEmployeeActiveInput): MutationResult {
  const id = Number(input.id)

  if (!id) {
    throw new Error('الموظف غير صحيح')
  }

  const db = getDb()

  const result = db
    .prepare(
      `
      UPDATE employees
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
    throw new Error('الموظف غير موجود')
  }

  return { success: true }
}


export function deleteEmployee(input: DeleteEmployeeInput): MutationResult {
  const id = Number(input.id)

  if (!id) {
    throw new Error('الموظف غير صحيح')
  }

  const db = getDb()

  const transaction = db.transaction(() => {
    db.prepare(
      `
      DELETE FROM monthly_evaluations
      WHERE employee_id = ?
    `
    ).run(id)

    const result = db
      .prepare(
        `
        DELETE FROM employees
        WHERE id = ?
      `
      )
      .run(id)

    if (result.changes === 0) {
      throw new Error('الموظف غير موجود')
    }
  })

  transaction()

  return { success: true }
}