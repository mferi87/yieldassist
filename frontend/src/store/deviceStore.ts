import { create } from 'zustand'
import { api } from '../api/client'

export interface ZigbeeDevice {
    id: string
    hub_id: string
    zone_id?: string
    ieee_address: string
    friendly_name?: string
    model?: string
    vendor?: string
    description?: string
    exposes: any[]
    is_online: boolean
    last_seen?: string
}

interface DeviceStore {
    devices: ZigbeeDevice[]
    isLoading: boolean
    error: string | null
    fetchDevices: () => Promise<void>
    updateDevice: (id: string, data: Partial<ZigbeeDevice>) => Promise<void>
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
    devices: [],
    isLoading: false,
    error: null,

    fetchDevices: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/devices')
            const data = Array.isArray(response.data) ? response.data : []
            set({ devices: data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    updateDevice: async (id, data) => {
        try {
            const response = await api.put(`/devices/${id}`, data)
            set((state) => ({
                devices: state.devices.map((d) => (d.id === id ? { ...d, ...response.data } : d))
            }))
        } catch (error: any) {
            set({ error: error.message })
            throw error
        }
    }
}))
