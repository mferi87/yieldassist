import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface User {
    id: string
    email: string
    name: string
    is_global_admin: boolean
}

interface AuthState {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, name: string) => Promise<void>
    logout: () => void
    clearError: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null })
                try {
                    const params = new URLSearchParams()
                    params.append('username', email)
                    params.append('password', password)

                    const response = await api.post('/api/auth/login', params, {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    })

                    const token = response.data.access_token
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`

                    const userResponse = await api.get('/api/auth/me')

                    set({
                        token,
                        user: userResponse.data,
                        isAuthenticated: true,
                        isLoading: false,
                    })
                } catch (error: any) {
                    set({
                        error: error.response?.data?.detail || 'Login failed',
                        isLoading: false,
                    })
                    throw error
                }
            },

            register: async (email: string, password: string, name: string) => {
                set({ isLoading: true, error: null })
                try {
                    await api.post('/api/auth/register', { email, password, name })
                    await get().login(email, password)
                } catch (error: any) {
                    set({
                        error: error.response?.data?.detail || 'Registration failed',
                        isLoading: false,
                    })
                    throw error
                }
            },

            logout: () => {
                delete api.defaults.headers.common['Authorization']
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                })
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
            onRehydrate: (state) => {
                if (state?.token) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
                }
            },
        }
    )
)
