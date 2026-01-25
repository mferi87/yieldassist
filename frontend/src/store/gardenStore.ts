import { create } from 'zustand'
import { api } from '../api/client'

export interface Garden {
    id: string
    name: string
    width_meters: number
    height_meters: number
    preview_image?: string
    created_at: string
    role: 'admin' | 'editor' | 'viewer'
}

export interface Bed {
    id: string
    garden_id: string
    name: string
    width_cells: number
    height_cells: number
    position_x: number
    position_y: number
}

export interface Zone {
    id: string
    bed_id: string
    name: string
    cells: number[][]  // Deprecated
    color: string
}

interface GardenState {
    gardens: Garden[]
    currentGarden: Garden | null
    beds: Bed[]
    zones: Zone[]
    isLoading: boolean
    error: string | null
    fetchGardens: () => Promise<void>
    fetchGarden: (id: string) => Promise<void>
    createGarden: (data: { name: string; width_meters: number; height_meters: number }) => Promise<Garden>
    updateGarden: (id: string, data: Partial<Garden>) => Promise<void>
    deleteGarden: (id: string) => Promise<void>
    fetchBeds: (gardenId: string) => Promise<void>
    createBed: (data: Omit<Bed, 'id'>) => Promise<Bed>
    updateBed: (id: string, data: Partial<Bed>) => Promise<void>
    deleteBed: (id: string) => Promise<void>
    fetchZones: (bedId: string) => Promise<void>
    createZone: (data: { bed_id: string; name: string; color: string }) => Promise<Zone>
    updateZone: (id: string, data: Partial<Zone>) => Promise<void>
    deleteZone: (id: string) => Promise<void>
}

export const useGardenStore = create<GardenState>((set, get) => ({
    gardens: [],
    currentGarden: null,
    beds: [],
    zones: [],
    isLoading: false,
    error: null,

    fetchGardens: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/api/gardens/')
            set({ gardens: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    fetchGarden: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/api/gardens/${id}`)
            set({ currentGarden: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createGarden: async (data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/api/gardens/', data)
            const newGarden = { ...response.data, role: 'admin' as const }
            set((state) => ({
                gardens: [...state.gardens, newGarden],
                isLoading: false
            }))
            return newGarden
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updateGarden: async (id, data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.patch(`/api/gardens/${id}`, data)
            set((state) => ({
                gardens: state.gardens.map((g) => (g.id === id ? { ...g, ...response.data } : g)),
                currentGarden: state.currentGarden?.id === id ? { ...state.currentGarden, ...response.data } : state.currentGarden,
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    deleteGarden: async (id) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/gardens/${id}`)
            set((state) => ({
                gardens: state.gardens.filter((g) => g.id !== id),
                currentGarden: state.currentGarden?.id === id ? null : state.currentGarden,
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    fetchBeds: async (gardenId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/api/beds/garden/${gardenId}`)
            set({ beds: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createBed: async (data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/api/beds/', data)
            set((state) => ({
                beds: [...state.beds, response.data],
                isLoading: false,
            }))
            return response.data
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updateBed: async (id, data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.patch(`/api/beds/${id}`, data)
            set((state) => ({
                beds: state.beds.map((b) => (b.id === id ? { ...b, ...response.data } : b)),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    deleteBed: async (id) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/beds/${id}`)
            set((state) => ({
                beds: state.beds.filter((b) => b.id !== id),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    fetchZones: async (bedId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/api/beds/${bedId}/zones`)
            set({ zones: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createZone: async (data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/api/beds/zones', data)
            set((state) => ({
                zones: [...state.zones, response.data],
                isLoading: false,
            }))
            return response.data
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updateZone: async (id, data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.patch(`/api/beds/zones/${id}`, data)
            set((state) => ({
                zones: state.zones.map((z) => (z.id === id ? { ...z, ...response.data } : z)),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    deleteZone: async (id) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/beds/zones/${id}`)
            set((state) => ({
                zones: state.zones.filter((z) => z.id !== id),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },
}))
