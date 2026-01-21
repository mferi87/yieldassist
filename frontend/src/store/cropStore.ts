import { create } from 'zustand'
import { api } from '../api/client'

export interface Crop {
    id: string
    name: string
    icon?: string
    cells_width: number
    cells_height: number
    per_cell: number
    spacing_cm: number
    row_spacing_cm: number
    care_schedule: Record<string, any>
    is_public: boolean
    is_approved: boolean
}

export interface CropPlacement {
    id: string
    bed_id: string
    crop_id: string
    position_x: number
    position_y: number
    width_cells: number
    height_cells: number
    custom_spacing_cm: number | null
    custom_row_spacing_cm: number | null
    planted_date: string | null
    status: 'planned' | 'planted' | 'growing' | 'harvested'
    crop: Crop
}

interface CropState {
    crops: Crop[]
    placements: CropPlacement[]
    gardenPlacements: CropPlacement[]
    isLoading: boolean
    error: string | null
    fetchCrops: () => Promise<void>
    fetchPlacements: (bedId: string) => Promise<void>
    fetchGardenPlacements: (gardenId: string) => Promise<void>
    createPlacement: (data: {
        bed_id: string
        crop_id: string
        position_x: number
        position_y: number
        width_cells: number
        height_cells: number
        custom_spacing_cm?: number
        custom_row_spacing_cm?: number
    }) => Promise<CropPlacement>
    updatePlacement: (id: string, data: Partial<CropPlacement>) => Promise<void>
    deletePlacement: (id: string) => Promise<void>
    createCrop: (data: Omit<Crop, 'id' | 'care_schedule'> & { care_schedule?: Record<string, any> }) => Promise<void>
    updateCrop: (id: string, data: Partial<Crop>) => Promise<void>
    deleteCrop: (id: string) => Promise<void>
}

export const useCropStore = create<CropState>((set, get) => ({
    crops: [],
    placements: [],
    gardenPlacements: [],
    isLoading: false,
    error: null,

    fetchCrops: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/api/crops/', { params: { include_private: true } })
            set({ crops: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    fetchPlacements: async (bedId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/api/crops/placements/bed/${bedId}`)
            set({ placements: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    fetchGardenPlacements: async (gardenId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/api/crops/placements/garden/${gardenId}`)
            set({ gardenPlacements: response.data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createPlacement: async (data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/api/crops/placements', data)
            set((state) => ({
                placements: [...state.placements, response.data],
                isLoading: false,
            }))
            return response.data
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updatePlacement: async (id, data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.patch(`/api/crops/placements/${id}`, data)
            set((state) => ({
                placements: state.placements.map((p) => (p.id === id ? { ...p, ...response.data } : p)),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    deletePlacement: async (id) => {
        const currentPlacements = get().placements
        const placementToDelete = currentPlacements.find(p => p.id === id)

        if (!placementToDelete) {
            console.error('Placement not found:', id)
            return
        }

        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/crops/placements/${id}`)
            // Immediately update local state
            set({
                placements: currentPlacements.filter((p) => p.id !== id),
                isLoading: false,
            })
            // Also refetch from server to ensure sync
            if (placementToDelete.bed_id) {
                const response = await api.get(`/api/crops/placements/bed/${placementToDelete.bed_id}`)
                set({ placements: response.data })
            }
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createCrop: async (data: Omit<Crop, 'id' | 'is_public' | 'is_approved' | 'care_schedule'> & { care_schedule?: Record<string, any> }) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/api/crops/', data)
            set((state) => ({
                crops: [...state.crops, response.data],
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updateCrop: async (id: string, data: Partial<Crop>) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.patch(`/api/crops/${id}`, data)
            set((state) => ({
                crops: state.crops.map((c) => (c.id === id ? response.data : c)),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    deleteCrop: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/api/crops/${id}`)
            set((state) => ({
                crops: state.crops.filter((c) => c.id !== id),
                isLoading: false,
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },
}))
