export type DepartmentRow = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  sort_order: number
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

export type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  sort_order: number
  notes: string
  active: boolean
}

export type UpdateDepartmentInput = CreateDepartmentInput & {
  id: number
}

export type SetDepartmentActiveInput = {
  id: number
  active: boolean
}

export type ListDepartmentsInput = {
  includeInactive?: boolean
}

export type DeleteDepartmentInput = {
  id: number
}