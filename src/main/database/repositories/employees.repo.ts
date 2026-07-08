import { getDb } from '../db'
import type { MutationResult } from '../../types/common'
import type { CreateEmployeeInput, EmployeeRow } from '../../types/employees'

export function listEmployees(): EmployeeRow[] {
  const db = getDb()

  return db
    .prepare(
      `
      SELECT
        e.id,
        e.employee_number,
        e.name,
        e.national_id,
        e.qualification,
        e.job_title,
        e.department_id,
        d.name AS department_name,
        e.notes,
        e.active,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER BY e.name
    `
    )
    .all() as EmployeeRow[]
}

export function createEmployee(input: CreateEmployeeInput): MutationResult {
  const employeeNumber = input.employee_number.trim()
  const name = input.name.trim()
  const nationalId = input.national_id.trim()

  if (!employeeNumber) {
    throw new Error('رقم الموظف مطلوب')
  }

  if (!name) {
    throw new Error('اسم الموظف مطلوب')
  }

  if (!/^\d{14}$/.test(nationalId)) {
    throw new Error('الرقم القومي لازم يكون 14 رقم بالظبط')
  }

  const db = getDb()

  try {
    db.prepare(
      `
      INSERT INTO employees (
        employee_number,
        name,
        national_id,
        qualification,
        job_title,
        department_id,
        notes,
        active
      )
      VALUES (
        @employee_number,
        @name,
        @national_id,
        @qualification,
        @job_title,
        @department_id,
        @notes,
        @active
      )
    `
    ).run({
      employee_number: employeeNumber,
      name,
      national_id: nationalId,
      qualification: input.qualification.trim(),
      job_title: input.job_title.trim(),
      department_id: input.department_id,
      notes: input.notes.trim(),
      active: input.active ? 1 : 0
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new Error('رقم الموظف موجود قبل كده')
    }

    throw error
  }

  return { success: true }
}