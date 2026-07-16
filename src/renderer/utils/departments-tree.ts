import type { Department } from '../types/api'

export type DepartmentTreeNode = Department & {
  level: number
  path: string
  children: DepartmentTreeNode[]
}

function sortDepartments<T extends { name: string; id: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.id - b.id)
}

export function buildDepartmentTree(departments: Department[]): DepartmentTreeNode[] {
  const nodeMap = new Map<number, DepartmentTreeNode>()
  const roots: DepartmentTreeNode[] = []

  for (const department of departments) {
    nodeMap.set(department.id, {
      ...department,
      level: 0,
      path: department.name,
      children: []
    })
  }

  for (const node of nodeMap.values()) {
    if (node.parent_id && node.parent_id !== node.id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function applyLevel(nodes: DepartmentTreeNode[], level: number, parentPath: string): void {
    const sortedNodes = sortDepartments(nodes)

    nodes.length = 0
    nodes.push(...sortedNodes)

    for (const node of nodes) {
      node.level = level
      node.path = parentPath ? `${parentPath} / ${node.name}` : node.name
      applyLevel(node.children, level + 1, node.path)
    }
  }

  applyLevel(roots, 0, '')

  return sortDepartments(roots)
}

export function flattenDepartmentTree(departments: Department[]): DepartmentTreeNode[] {
  const tree = buildDepartmentTree(departments)
  const output: DepartmentTreeNode[] = []

  function walk(nodes: DepartmentTreeNode[]): void {
    for (const node of nodes) {
      output.push(node)
      walk(node.children)
    }
  }

  walk(tree)

  return output
}

export function getDepartmentAndDescendantIds(
  departments: Department[],
  departmentId: number
): number[] {
  const targetId = Number(departmentId)
  const childrenByParentId = new Map<number | null, Department[]>()

  for (const department of departments) {
    const key = department.parent_id ?? null
    const current = childrenByParentId.get(key) || []
    current.push(department)
    childrenByParentId.set(key, current)
  }

  if (!departments.some((department) => department.id === targetId)) {
    return []
  }

  const ids: number[] = []

  function walk(id: number): void {
    ids.push(id)

    for (const child of childrenByParentId.get(id) || []) {
      walk(child.id)
    }
  }

  walk(targetId)

  return ids
}

export function sortEmployeesByDepartmentTree<
  T extends {
    employee_id: number
    employee_name: string
    department_id: number | null
  }
>(employees: T[], departments: Department[]): T[] {
  const departmentOrder = new Map<number, number>()

  flattenDepartmentTree(departments).forEach((department, index) => {
    departmentOrder.set(department.id, index)
  })

  return [...employees].sort((first, second) => {
    const firstDepartmentOrder =
      first.department_id === null
        ? Number.MAX_SAFE_INTEGER
        : (departmentOrder.get(first.department_id) ?? Number.MAX_SAFE_INTEGER)

    const secondDepartmentOrder =
      second.department_id === null
        ? Number.MAX_SAFE_INTEGER
        : (departmentOrder.get(second.department_id) ?? Number.MAX_SAFE_INTEGER)

    if (firstDepartmentOrder !== secondDepartmentOrder) {
      return firstDepartmentOrder - secondDepartmentOrder
    }

    const nameComparison = first.employee_name.localeCompare(second.employee_name, 'ar')

    if (nameComparison !== 0) {
      return nameComparison
    }

    return first.employee_id - second.employee_id
  })
}

export function sortDepartmentSummaryByTree<
  T extends {
    department_id: number | null
  }
>(items: T[], departments: Department[]): T[] {
  const departmentOrder = new Map<number, number>()

  flattenDepartmentTree(departments).forEach((department, index) => {
    departmentOrder.set(department.id, index)
  })

  return [...items].sort((first, second) => {
    const firstOrder =
      first.department_id === null
        ? Number.MAX_SAFE_INTEGER
        : (departmentOrder.get(first.department_id) ?? Number.MAX_SAFE_INTEGER)

    const secondOrder =
      second.department_id === null
        ? Number.MAX_SAFE_INTEGER
        : (departmentOrder.get(second.department_id) ?? Number.MAX_SAFE_INTEGER)

    return firstOrder - secondOrder
  })
}