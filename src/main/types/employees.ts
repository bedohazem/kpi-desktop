export type EmployeeRow = {
  id: number
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

export type CreateEmployeeInput = {
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
  notes: string
  active: boolean
}