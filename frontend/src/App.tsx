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

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore()
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
                path="/"
                element={
                    <PrivateRoute>
                        <Layout />
                    </PrivateRoute>
                }
            >
                <Route index element={<GardensPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="garden/:gardenId" element={<OverviewPage />} />
                <Route path="garden/:gardenId/beds" element={<BedsPage />} />
                <Route path="garden/:gardenId/crops" element={<CropsPage />} />
            </Route>
        </Routes>
    )
}

export default App
