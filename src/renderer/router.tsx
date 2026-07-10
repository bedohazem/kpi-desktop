import { createHashRouter } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DashboardPage from './pages/Dashboard/DashboardPage'
import DepartmentsPage from './pages/Departments/DepartmentsPage'
import EmployeesPage from './pages/Employees/EmployeesPage'
import EvaluationsPage from './pages/Evaluations/EvaluationsPage'
import ReportsPage from './pages/Reports/ReportsPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: 'departments',
        element: <DepartmentsPage />
      },
      {
        path: 'employees',
        element: <EmployeesPage />
      },
      {
        path: 'evaluations',
        element: <EvaluationsPage />
      },
      {
        path: 'reports',
        element: <ReportsPage />
      }
    ]
  }
])