import { create } from 'zustand'
import { api } from '../api/client'

export interface User {
    id: string
    email: string
    name: string
    is_global_admin: boolean
    created_at: string
}

interface UserState {
    users: User[]
    isLoading: boolean
    error: string | null
    fetchUsers: () => Promise<void>
    updateUserAdminStatus: (userId: string, isGlobalAdmin: boolean) => Promise<void>
    deleteUser: (userId: string) => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
    users: [],
    isLoading: false,
    error: null,

    fetchUsers: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/api/users/')
            set({ users: response.data, isLoading: false })
        } catch (error: any) {
            set({
                error: error.response?.data?.detail || 'Failed to fetch users',
                isLoading: false
            })
        }
    },

    updateUserAdminStatus: async (userId: string, isGlobalAdmin: boolean) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.put(`/api/users/${userId}/admin`, null, {
                params: { is_global_admin: isGlobalAdmin }
            })

            // Update the user in the local state
            const updatedUser = response.data
            set(state => ({
                users: state.users.map(u => u.id === userId ? updatedUser : u),
                isLoading: false
            }))
        } catch (error: any) {
            set({
                error: error.response?.data?.detail || 'Failed to update user status',
                isLoading: false
            })
            throw error
        }
    },

    deleteUser: async (userId: string) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/users/${userId}`)

            // Remove the user from local state
            set(state => ({
                users: state.users.filter(u => u.id !== userId),
                isLoading: false
            }))
        } catch (error: any) {
            set({
                error: error.response?.data?.detail || 'Failed to delete user',
                isLoading: false
            })
            throw error
        }
    }
}))
