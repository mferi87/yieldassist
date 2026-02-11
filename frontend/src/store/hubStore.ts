import { create } from 'zustand'
import { api } from '../api/client'

export interface Hub {
    id: string
    name: string
    ip_address: string
    status: string
    last_seen: string | null
    is_online: boolean
}

interface HubStore {
    hubs: Hub[]
    isLoading: boolean
    error: string | null
    fetchHubs: () => Promise<void>
    updateHubStatus: (hubId: string, status: string, name?: string) => Promise<void>
    deleteHub: (hubId: string) => Promise<void>
}

export const useHubStore = create<HubStore>((set, get) => ({
    hubs: [],
    isLoading: false,
    error: null,

    fetchHubs: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/api/hubs')

            // Check if response looks like HTML (wrong URL)
            if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE html>')) {
                throw new Error('API Misconfigured: Received HTML instead of JSON. Check VITE_API_URL.')
            }

            const data = Array.isArray(response.data) ? response.data : []
            set({ hubs: data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    updateHubStatus: async (hubId, status, name) => {
        try {
            await api.put(`/api/hubs/${hubId}/status`, { status, name })
            // Refresh list
            get().fetchHubs()
        } catch (error: any) {
            set({ error: error.message })
        }
    },

    deleteHub: async (hubId) => {
        try {
            await api.delete(`/api/hubs/${hubId}`)
            // Refresh list
            get().fetchHubs()
        } catch (error: any) {
            set({ error: error.message })
        }
    }
}))
