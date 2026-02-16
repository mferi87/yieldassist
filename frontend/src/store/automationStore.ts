import { create } from 'zustand'
import { api } from '../api/client'

// --- Trigger Types ---
export interface StateTrigger {
    type: 'state'
    device_id: string
    entity: string
    operator: '>' | '<' | '==' | '!=' | '>=' | '<='
    value: number | string | boolean
}

export interface TimeTrigger {
    type: 'time'
    at: string // HH:MM:SS
}

export interface TimePatternTrigger {
    type: 'time_pattern'
    hours?: string  // e.g. "/2" for every 2 hours, "*" for any, or specific value
    minutes?: string
    seconds?: string
}

export interface DeviceStateChangedTrigger {
    type: 'device_state_changed'
    device_id: string
    entity: string
}

export type AutomationTrigger = StateTrigger | TimeTrigger | TimePatternTrigger | DeviceStateChangedTrigger

// --- Condition Types ---
export interface StateCondition {
    type: 'state'
    device_id: string
    entity: string
    operator: '>' | '<' | '==' | '!=' | '>=' | '<='
    value: number | string | boolean
}

export type AutomationCondition = StateCondition

// --- Action Types ---
export interface DeviceAction {
    type: 'device_action'
    device_id: string
    entity: string
    value: number | string | boolean
}

export interface DelayAction {
    type: 'delay'
    seconds: number
}

export interface ChooseAction {
    type: 'choose'
    choices: {
        conditions: AutomationCondition[]
        sequence: AutomationAction[]
    }[]
    default: AutomationAction[]
}

export interface IfAction {
    type: 'if'
    conditions: AutomationCondition[]
    then: AutomationAction[]
    else: AutomationAction[]
}

export interface ConditionAction {
    type: 'condition'
    conditions: AutomationCondition[]
}

export type AutomationAction = DeviceAction | DelayAction | ChooseAction | IfAction | ConditionAction

// --- Automation ---
export interface Automation {
    id: string
    hub_id: string
    name: string
    description?: string
    triggers: AutomationTrigger[]
    conditions: AutomationCondition[]
    actions: AutomationAction[]
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
            const url = hubId ? `/api/hubs/${hubId}/automations` : '/api/automations'
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
            const response = await api.post('/api/automations', data)
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
            const response = await api.put(`/api/automations/${id}`, data)
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
            await api.delete(`/api/automations/${id}`)
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

// --- Helper functions ---
export function createEmptyStateTrigger(): StateTrigger {
    return { type: 'state', device_id: '', entity: '', operator: '>', value: 0 }
}

export function createEmptyTimeTrigger(): TimeTrigger {
    return { type: 'time', at: '06:00:00' }
}

export function createEmptyTimePatternTrigger(): TimePatternTrigger {
    return { type: 'time_pattern', hours: '*', minutes: '/1', seconds: '0' }
}

export function createEmptyDeviceStateChangedTrigger(): DeviceStateChangedTrigger {
    return { type: 'device_state_changed', device_id: '', entity: '' }
}

export function createEmptyCondition(): StateCondition {
    return { type: 'state', device_id: '', entity: '', operator: '>', value: 0 }
}

export function createEmptyDeviceAction(): DeviceAction {
    return { type: 'device_action', device_id: '', entity: '', value: '' }
}

export function createEmptyDelayAction(): DelayAction {
    return { type: 'delay', seconds: 60 }
}

export function createEmptyChooseAction(): ChooseAction {
    return {
        type: 'choose',
        choices: [{ conditions: [createEmptyCondition()], sequence: [createEmptyDeviceAction()] }],
        default: []
    }
}

export function createEmptyIfAction(): IfAction {
    return {
        type: 'if',
        conditions: [createEmptyCondition()],
        then: [createEmptyDeviceAction()],
        else: []
    }
}

export function createEmptyConditionAction(): ConditionAction {
    return { type: 'condition', conditions: [createEmptyCondition()] }
}
