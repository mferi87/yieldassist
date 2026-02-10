import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { LayoutGrid, Layers, Sprout, LogOut, User, ChevronDown, Moon, Sun, Router } from 'lucide-react'
import { useState } from 'react'

export default function Layout() {
    const { t } = useTranslation()
    const { user, logout } = useAuthStore()
    const { isDark, toggleTheme } = useThemeStore()
    const { gardenId } = useParams()
    const navigate = useNavigate()
    const [showUserMenu, setShowUserMenu] = useState(false)

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const navItems = gardenId
        ? [
            { to: `/garden/${gardenId}`, icon: LayoutGrid, label: t('nav.overview') },
            { to: `/garden/${gardenId}/beds`, icon: Layers, label: t('nav.beds') },
            { to: `/garden/${gardenId}/crops`, icon: Sprout, label: t('nav.crops') },
        ]
        : []

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-primary-50 via-white to-earth-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg">
            {/* Header */}
            <header className="bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md border-b border-primary-100 dark:border-gray-800 sticky top-0 z-50 shrink-0">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <NavLink to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg group-hover:shadow-primary-200 dark:group-hover:shadow-primary-900 transition-shadow">
                                <Sprout className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                                YieldAssist α
                            </span>
                        </NavLink>

                        {/* Navigation */}
                        {navItems.length > 0 && (
                            <nav className="flex items-center gap-1">
                                {navItems.map(({ to, icon: Icon, label }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={to === `/garden/${gardenId}`}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isActive
                                                ? 'bg-primary-100 dark:bg-dark-selected text-primary-700 dark:text-primary-400'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-surface hover:text-gray-900 dark:hover:text-white'
                                            }`
                                        }
                                    >
                                        <Icon className="w-5 h-5" />
                                        {label}
                                    </NavLink>
                                ))}
                            </nav>
                        )}

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.name}</span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-surface rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                        {/* Theme Toggle */}
                                        <button
                                            onClick={() => {
                                                toggleTheme()
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg"
                                        >
                                            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                            {isDark ? 'Light Mode' : 'Dark Mode'}
                                        </button>

                                        {/* Divider */}
                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            {t('auth.logout')}
                                        </button>

                                        {user?.is_global_admin && (
                                            <>
                                                {/* Divider */}
                                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>

                                                <NavLink
                                                    to="/hubs"
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg mb-1"
                                                    onClick={() => setShowUserMenu(false)}
                                                >
                                                    <Router className="w-4 h-4 ml-0.5" />
                                                    Hub Management
                                                </NavLink>

                                                <NavLink
                                                    to="/automations"
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg mb-1"
                                                    onClick={() => setShowUserMenu(false)}
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center">
                                                        <Layers className="w-3 h-3" />
                                                    </div>
                                                    Automations
                                                </NavLink>

                                                {/* Divider */}
                                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>

                                                <NavLink
                                                    to="/admin"
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg mb-1"
                                                    onClick={() => setShowUserMenu(false)}
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center">
                                                        <span className="text-xs font-bold">A</span>
                                                    </div>
                                                    Admin Dashboard
                                                </NavLink>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full min-h-0 overflow-hidden flex flex-col">
                <Outlet />
            </main>
        </div>
    )
}

