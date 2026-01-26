import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Trash2, Play, ChevronRight, Zap, Save, ChevronLeft } from 'lucide-react'
import { api } from '../api/client'

interface LogicBlock {
    type: string
    device_id?: string
    attribute?: string
    operator?: string
    value?: any
    action?: string
}

interface Automation {
    id: string
    name: string
    is_enabled: boolean
    triggers: LogicBlock[]
    conditions: LogicBlock[]
    actions: LogicBlock[]
}

export default function AutomationsPage() {
    const { hubId } = useParams()
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)
    const [editingAutomation, setEditingAutomation] = useState<Partial<Automation> | null>(null)
    const [myHubs, setMyHubs] = useState<any[]>([])

    useEffect(() => {
        fetchAutomations()
        if (!hubId) fetchHubs()
    }, [hubId])

    const fetchHubs = async () => {
        try {
            const res = await api.get('/api/hubs/my-hubs')
            setMyHubs(res.data.filter((h: any) => h.is_approved))
        } catch (err) {
            console.error('Failed to fetch hubs', err)
        }
    }

    const fetchAutomations = async () => {
        setLoading(true)
        try {
            const url = hubId ? `/api/automations/hub/${hubId}` : `/api/automations`
            const res = await api.get(url)
            setAutomations(res.data)
        } catch (err) {
            console.error('Failed to fetch automations', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!editingAutomation) return
        const finalHubId = hubId || editingAutomation.hub_id
        if (!finalHubId) {
            alert('Please select a hub')
            return
        }

        try {
            if (editingAutomation.id) {
                await api.patch(`/api/automations/${editingAutomation.id}`, editingAutomation)
            } else {
                await api.post(`/api/automations`, { ...editingAutomation, hub_id: finalHubId })
            }
            setEditingAutomation(null)
            fetchAutomations()
        } catch (err) {
            console.error('Failed to save automation', err)
            alert('Failed to save automation')
        }
    }

    const deleteAutomation = async (id: string) => {
        if (!confirm('Are you sure you want to delete this automation?')) return
        try {
            await api.delete(`/api/automations/${id}`)
            fetchAutomations()
        } catch (err) {
            console.error('Failed to delete', err)
        }
    }

    const addBlock = (section: 'triggers' | 'conditions' | 'actions') => {
        if (!editingAutomation) return
        const newBlock = section === 'actions'
            ? { type: 'valve', action: 'toggle' }
            : { type: 'sensor', attribute: 'soil_moisture', operator: '<', value: 30 }

        setEditingAutomation({
            ...editingAutomation,
            [section]: [...(editingAutomation[section] || []), newBlock]
        })
    }

    return (
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-gray-100">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/devices" className="p-2 hover:bg-white dark:hover:bg-dark-surface rounded-xl transition-colors">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold">Local Automations</h1>
                            <p className="text-gray-500">Rules that run directly on your hub.</p>
                        </div>
                    </div>
                    {!editingAutomation && (
                        <button
                            onClick={() => setEditingAutomation({ name: 'New Automation', triggers: [], conditions: [], actions: [], is_enabled: true })}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium shadow-lg shadow-primary-500/20"
                        >
                            <Plus className="w-5 h-5" />
                            Create Automation
                        </button>
                    )}
                </header>

                {editingAutomation ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Hub Selection (if in global mode) */}
                        {!hubId && !editingAutomation.id && (
                            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <label className="block text-xs font-bold uppercase tracking-wider text-primary-500 mb-2">Target Hub</label>
                                <select
                                    value={editingAutomation.hub_id || ''}
                                    onChange={e => setEditingAutomation({ ...editingAutomation, hub_id: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                                >
                                    <option value="">Select a hub...</option>
                                    {myHubs.map(hub => (
                                        <option key={hub.id} value={hub.id}>{hub.name || hub.device_id}</option>
                                    ))}
                                </select>
                                {myHubs.length === 0 && <p className="text-sm text-red-500 mt-2">No approved hubs found. Please approve a hub in My Devices first.</p>}
                            </div>
                        )}

                        {/* Name Input */}
                        <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Automation Name</label>
                            <input
                                type="text"
                                value={editingAutomation.name || ''}
                                onChange={e => setEditingAutomation({ ...editingAutomation, name: e.target.value })}
                                className="text-2xl font-bold bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:outline-none w-full pb-1"
                                placeholder="Enter name..."
                            />
                        </div>

                        {/* triggers */}
                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-primary-600 dark:text-primary-400 px-1">
                                <Zap className="w-5 h-5" /> When
                            </h3>
                            <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
                                {editingAutomation.triggers?.map((t, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500">Sensor</span>
                                            <select
                                                value={t.attribute}
                                                onChange={e => {
                                                    const next = [...(editingAutomation.triggers || [])]
                                                    next[i] = { ...next[i], attribute: e.target.value }
                                                    setEditingAutomation({ ...editingAutomation, triggers: next })
                                                }}
                                                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="soil_moisture">Soil Moisture</option>
                                                <option value="temperature">Temperature</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500">is</span>
                                            <select
                                                value={t.operator}
                                                onChange={e => {
                                                    const next = [...(editingAutomation.triggers || [])]
                                                    next[i] = { ...next[i], operator: e.target.value }
                                                    setEditingAutomation({ ...editingAutomation, triggers: next })
                                                }}
                                                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="<">Below</option>
                                                <option value=">">Above</option>
                                                <option value="==">Equal to</option>
                                            </select>
                                        </div>
                                        <input
                                            type="number"
                                            value={t.value || 0}
                                            onChange={e => {
                                                const next = [...(editingAutomation.triggers || [])]
                                                next[i] = { ...next[i], value: Number(e.target.value) }
                                                setEditingAutomation({ ...editingAutomation, triggers: next })
                                            }}
                                            className="w-20 bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                            onClick={() => {
                                                const next = editingAutomation.triggers?.filter((_, idx) => idx !== i)
                                                setEditingAutomation({ ...editingAutomation, triggers: next })
                                            }}
                                            className="ml-auto p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addBlock('triggers')}
                                    className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-bold px-2 py-1"
                                >
                                    <Plus className="w-4 h-4" /> Add Trigger
                                </button>
                            </div>
                        </div>

                        {/* conditions */}
                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-orange-600 dark:text-orange-400 px-1">
                                <Plus className="w-5 h-5" /> And If
                            </h3>
                            <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
                                {editingAutomation.conditions?.map((c, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500">Sensor</span>
                                            <select
                                                value={c.attribute}
                                                onChange={e => {
                                                    const next = [...(editingAutomation.conditions || [])]
                                                    next[i] = { ...next[i], attribute: e.target.value }
                                                    setEditingAutomation({ ...editingAutomation, conditions: next })
                                                }}
                                                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="soil_moisture">Soil Moisture</option>
                                                <option value="temperature">Temperature</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500">is</span>
                                            <select
                                                value={c.operator}
                                                onChange={e => {
                                                    const next = [...(editingAutomation.conditions || [])]
                                                    next[i] = { ...next[i], operator: e.target.value }
                                                    setEditingAutomation({ ...editingAutomation, conditions: next })
                                                }}
                                                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="<">Below</option>
                                                <option value=">">Above</option>
                                                <option value="==">Equal to</option>
                                            </select>
                                        </div>
                                        <input
                                            type="number"
                                            value={c.value || 0}
                                            onChange={e => {
                                                const next = [...(editingAutomation.conditions || [])]
                                                next[i] = { ...next[i], value: Number(e.target.value) }
                                                setEditingAutomation({ ...editingAutomation, conditions: next })
                                            }}
                                            className="w-20 bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                            onClick={() => {
                                                const next = editingAutomation.conditions?.filter((_, idx) => idx !== i)
                                                setEditingAutomation({ ...editingAutomation, conditions: next })
                                            }}
                                            className="ml-auto p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addBlock('conditions')}
                                    className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm font-bold px-2 py-1"
                                >
                                    <Plus className="w-4 h-4" /> Add Condition
                                </button>
                            </div>
                        </div>

                        {/* actions */}
                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-green-600 dark:text-green-400 px-1">
                                <Play className="w-5 h-5" /> Then Do
                            </h3>
                            <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
                                {editingAutomation.actions?.map((a, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500">Action</span>
                                            <select
                                                value={a.action}
                                                onChange={e => {
                                                    const next = [...(editingAutomation.actions || [])]
                                                    next[i] = { ...next[i], action: e.target.value }
                                                    setEditingAutomation({ ...editingAutomation, actions: next })
                                                }}
                                                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="open">Open Valve</option>
                                                <option value="close">Close Valve</option>
                                                <option value="toggle">Toggle Valve</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const next = editingAutomation.actions?.filter((_, idx) => idx !== i)
                                                setEditingAutomation({ ...editingAutomation, actions: next })
                                            }}
                                            className="ml-auto p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addBlock('actions')}
                                    className="flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-bold px-2 py-1"
                                >
                                    <Plus className="w-4 h-4" /> Add Action
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setEditingAutomation(null)}
                                className="px-6 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-8 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-500/30 transition-all flex items-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Save Logic
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="py-20 text-center text-gray-400">Loading automations...</div>
                        ) : (
                            <>
                                {automations.map(auto => (
                                    <div key={auto.id} className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-900 transition-all flex items-center justify-between group shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${auto.is_enabled ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-600' : 'bg-gray-100 dark:bg-dark-bg text-gray-400'}`}>
                                                <Zap className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{auto.name}</h3>
                                                <div className="flex gap-2 mt-1 items-center">
                                                    <span className="text-xs bg-primary-50 dark:bg-primary-900/10 text-primary-600 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">
                                                        {auto.hub_name || 'Generic'}
                                                    </span>
                                                    <span className="text-xs bg-gray-100 dark:bg-dark-bg px-2 py-0.5 rounded text-gray-500">{auto.triggers.length} triggers</span>
                                                    <span className="text-xs bg-gray-100 dark:bg-dark-bg px-2 py-0.5 rounded text-gray-500">{auto.actions.length} actions</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditingAutomation(auto)}
                                                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => deleteAutomation(auto.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {automations.length === 0 && (
                                    <div className="text-center py-20 bg-white/50 dark:bg-dark-surface/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                        <Zap className="w-16 h-16 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-gray-400">No Automations Found</h3>
                                        <p className="text-gray-400 mb-8 max-w-xs mx-auto">Create rules that run directly on your hardware even without internet.</p>
                                        <button
                                            onClick={() => setEditingAutomation({ name: 'New Automation', triggers: [], conditions: [], actions: [], is_enabled: true })}
                                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary-500/30 transition-all"
                                        >
                                            Get Started
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
