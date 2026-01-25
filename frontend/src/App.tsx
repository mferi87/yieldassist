import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GardensPage from './pages/GardensPage'
import OverviewPage from './pages/OverviewPage'
import BedsPage from './pages/BedsPage'
import CropsPage from './pages/CropsPage'
import AdminPage from './pages/AdminPage'
import DevicesPage from './pages/DevicesPage'

import { Outlet } from 'react-router-dom'

function ProtectedRoute() {
    const { isAuthenticated } = useAuthStore()
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
                path="/"
                element={<Layout />}
            >
                <Route element={<ProtectedRoute />}>
                    <Route index element={<GardensPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="devices" element={<DevicesPage />} />
                    <Route path="garden/:gardenId" element={<OverviewPage />} />
                    <Route path="garden/:gardenId/beds" element={<BedsPage />} />
                    <Route path="garden/:gardenId/crops" element={<CropsPage />} />
                </Route>
            </Route>
        </Routes>
    )
}

export default App
