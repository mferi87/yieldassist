import { create } from 'zustand'
import { api } from '../api/client'

export interface AutomationTrigger {
    device_id: string
    entity: string // e.g. "temperature", "illuminance", "contact"
    operator: '>' | '<' | '==' | '!='
    value: number | string | boolean
}

export interface AutomationAction {
    device_id: string
    entity: string // e.g. "state", "brightness"
    value: number | string | boolean
}

export interface Automation {
    id: string
    hub_id: string
    name: string
    trigger: AutomationTrigger
    action: AutomationAction
    enabled: boolean
}

interface AutomationStore {
    automations: Automation[]
    isLoading: boolean
    error: string | null
    fetchAutomations: (hubId?: string) => Promise<void>
    createAutomation: (data: Omit<Automation, 'id'>) => Promise<Automation>
    updateAutomation: (id: string, data: Partial<Automation>) => Promise<void>
    deleteAutomation: (id: string) => Promise<void>
}

export const useAutomationStore = create<AutomationStore>((set) => ({
    automations: [],
    isLoading: false,
    error: null,

    fetchAutomations: async (hubId) => {
        set({ isLoading: true, error: null })
        try {
            // If hubId is provided, use the hub-specific endpoint, else generic?
            // API has GET /automations (all) and GET /hubs/{id}/automations (hub specific)
            // Let's use generic list if no hubId, or filter if supported. 
            // The backend /automations endpoint returns all. 
            // The /hubs/{id}/automations endpoint returns specific.
            // Let's support both or just use generic for now.
            const url = hubId ? `/hubs/${hubId}/automations` : '/automations'
            const response = await api.get(url)
            const data = Array.isArray(response.data) ? response.data : []
            set({ automations: data, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
        }
    },

    createAutomation: async (data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.post('/automations', data)
            set((state) => ({
                automations: [...state.automations, response.data],
                isLoading: false
            }))
            return response.data
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    updateAutomation: async (id, data) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.put(`/automations/${id}`, data)
            set((state) => ({
                automations: state.automations.map((a) => (a.id === id ? response.data : a)),
                isLoading: false
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    },

    deleteAutomation: async (id) => {
        set({ isLoading: true, error: null })
        try {
            await api.delete(`/automations/${id}`)
            set((state) => ({
                automations: state.automations.filter((a) => a.id !== id),
                isLoading: false
            }))
        } catch (error: any) {
            set({ error: error.message, isLoading: false })
            throw error
        }
    }
}))
