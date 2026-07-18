import { NavLink, Outlet } from 'react-router-dom'
import type { ReactElement } from 'react'
import ToastContainer from '../ui/ToastContainer'

export default function AppShell(): ReactElement {
  return (
    <div className="app">
      <ToastContainer />

      <div className="app-topbar">
        <header className="app-header">
          <div>
            <h1>برنامج التقييمات الشهرية</h1>
            <p>
              إدارة الإدارات والموظفين والتقييمات الشهرية
            </p>
          </div>
        </header>

        <nav className="tabs">
          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/"
            end
          >
            الرئيسية
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/departments"
          >
            الإدارات
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/employees"
          >
            الموظفين
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/evaluations"
          >
            التقييمات الشهرية
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/reports"
          >
            التقارير
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
            to="/backup"
          >
            النسخ الاحتياطي
          </NavLink>
        </nav>
      </div>

      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}