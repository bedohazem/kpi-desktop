export type EvaluationEmployeeRow = {
  employee_id: number
  employee_number: string | null
  employee_name: string
  job_title: string | null
  department_id: number | null
  department_name: string | null
  evaluation_id: number | null
  evaluation_value: number | null
  evaluation_notes: string | null
}

export type EvaluationFilters = {
  month: number
  year: number
  department_id: number | null
}

export type SaveEvaluationItem = {
  employee_id: number
  evaluation_value: number
  notes: string
}

export type SaveMonthlyEvaluationsInput = {
  month: number
  year: number
  items: SaveEvaluationItem[]
}

export type CopyPreviousMonthInput = {
  month: number
  year: number
  department_id: number | null
}

export type CopyPreviousMonthResult = {
  success: boolean
  copied: number
}