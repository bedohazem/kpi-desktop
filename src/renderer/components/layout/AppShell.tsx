import { NavLink, Outlet } from 'react-router-dom'
import type { ReactElement } from 'react'

export default function AppShell(): ReactElement {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>برنامج التقييمات الشهرية</h1>
          <p>إدارة الإدارات والموظفين والتقييمات الشهرية</p>
        </div>
      </header>

      <main className="page">
        <nav className="tabs">
          <NavLink className={({ isActive }) => (isActive ? 'tab active' : 'tab')} to="/">
            الرئيسية
          </NavLink>

          <NavLink
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            to="/departments"
          >
            الإدارات
          </NavLink>

          <NavLink
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            to="/employees"
          >
            الموظفين
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            to="/evaluations"
          >
            التقييمات الشهرية
          </NavLink>
        </nav>

        <Outlet />
      </main>
    </div>
  )
}