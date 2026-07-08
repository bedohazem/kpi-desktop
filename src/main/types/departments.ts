export type DepartmentRow = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

export type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  notes: string
  active: boolean
}