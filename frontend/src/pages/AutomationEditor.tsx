import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAutomationStore, type Automation } from '../store/automationStore'
import { useDeviceStore } from '../store/deviceStore'
import { useHubStore } from '../store/hubStore'
import { Plus, Trash2, Save, Play, RefreshCw, Loader2, ArrowRight } from 'lucide-react'

export default function AutomationEditor() {
    const { t } = useTranslation()
    const { automations, fetchAutomations, createAutomation, updateAutomation, deleteAutomation, isLoading } = useAutomationStore()
    const { devices, fetchDevices } = useDeviceStore()
    const { hubs, fetchHubs } = useHubStore()

    const [editingAutomation, setEditingAutomation] = useState<Partial<Automation> | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    useEffect(() => {
        fetchAutomations()
        fetchDevices()
        fetchHubs()
    }, [fetchAutomations, fetchDevices, fetchHubs])

    const handleSave = async () => {
        if (!editingAutomation || !editingAutomation.name || !editingAutomation.hub_id) return

        try {
            if (isCreating) {
                await createAutomation(editingAutomation as Omit<Automation, 'id'>)
            } else if (editingAutomation.id) {
                await updateAutomation(editingAutomation.id, editingAutomation)
            }
            setEditingAutomation(null)
            setIsCreating(false)
        } catch (error) {
            console.error('Failed to save automation:', error)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this automation?')) {
            await deleteAutomation(id)
            if (editingAutomation?.id === id) {
                setEditingAutomation(null)
                setIsCreating(false)
            }
        }
    }

    const startNewAutomation = () => {
        setEditingAutomation({
            name: 'New Automation',
            hub_id: hubs[0]?.id || '',
            enabled: true,
            trigger: {
                device_id: '',
                entity: '',
                operator: '>',
                value: 0
            },
            action: {
                device_id: '',
                entity: '',
                value: 0
            }
        })
        setIsCreating(true)
    }

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automations</h1>
                    <p className="text-gray-500 dark:text-gray-400">Create rules to automate your garden</p>
                </div>
                <button
                    onClick={startNewAutomation}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Automation
                </button>
            </div>

            <div className="flex-1 min-h-0 flex gap-6">
                {/* List of Automations */}
                <div className="w-80 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0 overflow-y-auto">
                    {isLoading && automations.length === 0 ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        </div>
                    ) : automations.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No automations found.</p>
                    ) : (
                        <div className="space-y-3">
                            {automations.map(automation => (
                                <div
                                    key={automation.id}
                                    onClick={() => {
                                        setEditingAutomation(automation)
                                        setIsCreating(false)
                                    }}
                                    className={`p-3 rounded-xl cursor-pointer border transition-colors ${editingAutomation?.id === automation.id
                                        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700'
                                        : 'bg-gray-50 dark:bg-dark-bg border-transparent hover:bg-gray-100 dark:hover:bg-dark-selected'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{automation.name}</span>
                                        <span className={`w-2 h-2 rounded-full ${automation.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {/* Simple summary */}
                                        If {devices.find(d => d.id === automation.trigger.device_id)?.friendly_name || '...'} {automation.trigger.operator} {automation.trigger.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Editor Panel */}
                <div className="flex-1 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-y-auto">
                    {editingAutomation ? (
                        <div className="max-w-3xl mx-auto space-y-8">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                    {isCreating ? 'Create Automation' : 'Edit Automation'}
                                </h2>
                                <div className="flex items-center gap-2">
                                    {!isCreating && editingAutomation.id && (
                                        <button
                                            onClick={() => handleDelete(editingAutomation.id!)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={!editingAutomation.name || !editingAutomation.hub_id}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={editingAutomation.name || ''}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hub</label>
                                    <select
                                        value={editingAutomation.hub_id}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, hub_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100"
                                    >
                                        <option value="" disabled>Select Hub</option>
                                        {hubs.map(hub => (
                                            <option key={hub.id} value={hub.id}>{hub.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Logic Builder */}
                            <div className="flex items-start gap-4">
                                {/* Trigger Card */}
                                <div className="flex-1 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                        <Play className="w-4 h-4 text-primary-500" />
                                        WHEN (Trigger)
                                    </h3>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Device</label>
                                            <select
                                                value={editingAutomation.trigger?.device_id}
                                                onChange={e => setEditingAutomation({
                                                    ...editingAutomation,
                                                    trigger: { ...editingAutomation.trigger!, device_id: e.target.value, entity: '' }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                            >
                                                <option value="" disabled>Select Device</option>
                                                {devices.filter(d => d.hub_id === editingAutomation.hub_id).map(device => (
                                                    <option key={device.id} value={device.id}>
                                                        {device.friendly_name || device.ieee_address}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Property</label>
                                            <select
                                                value={editingAutomation.trigger?.entity}
                                                onChange={e => setEditingAutomation({
                                                    ...editingAutomation,
                                                    trigger: { ...editingAutomation.trigger!, entity: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                            >
                                                <option value="" disabled>Select Property</option>
                                                {(() => {
                                                    const device = devices.find(d => d.id === editingAutomation.trigger?.device_id)
                                                    if (!device) return null

                                                    // Helper to extract flat list of properties
                                                    const properties: { value: string, label: string }[] = []

                                                    device.exposes.forEach((exp: any) => {
                                                        if (exp.type === 'numeric' || exp.type === 'binary' || exp.type === 'enum') {
                                                            properties.push({ value: exp.property || exp.name, label: exp.label || exp.name || exp.property })
                                                        } else if (exp.features) {
                                                            exp.features.forEach((feat: any) => {
                                                                if (feat.name || feat.property) {
                                                                    properties.push({ value: feat.property || feat.name, label: feat.label || feat.name || feat.property })
                                                                }
                                                            })
                                                        }
                                                    })

                                                    return properties.map(prop => (
                                                        <option key={prop.value} value={prop.value}>{prop.label}</option>
                                                    ))
                                                })()}
                                            </select>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="w-1/3">
                                                <label className="block text-xs text-gray-500 mb-1">Operator</label>
                                                <select
                                                    value={editingAutomation.trigger?.operator}
                                                    onChange={e => setEditingAutomation({
                                                        ...editingAutomation,
                                                        trigger: { ...editingAutomation.trigger!, operator: e.target.value as any }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                                >
                                                    <option value=">">&gt;</option>
                                                    <option value="<">&lt;</option>
                                                    <option value="==">=</option>
                                                    <option value="!=">!=</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">Value</label>
                                                <input
                                                    type="text"
                                                    value={editingAutomation.trigger?.value || ''}
                                                    onChange={e => setEditingAutomation({
                                                        ...editingAutomation,
                                                        trigger: { ...editingAutomation.trigger!, value: e.target.value }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                                    placeholder="e.g. 50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-10">
                                    <ArrowRight className="w-6 h-6 text-gray-400" />
                                </div>

                                {/* Action Card */}
                                <div className="flex-1 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-green-500" />
                                        THEN (Action)
                                    </h3>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Device (Actuator)</label>
                                            <select
                                                value={editingAutomation.action?.device_id}
                                                onChange={e => setEditingAutomation({
                                                    ...editingAutomation,
                                                    action: { ...editingAutomation.action!, device_id: e.target.value, entity: '' }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                            >
                                                <option value="" disabled>Select Device</option>
                                                {devices.filter(d => d.hub_id === editingAutomation.hub_id).map(device => (
                                                    <option key={device.id} value={device.id}>
                                                        {device.friendly_name || device.ieee_address}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Property to Set</label>
                                            <select
                                                value={editingAutomation.action?.entity}
                                                onChange={e => setEditingAutomation({
                                                    ...editingAutomation,
                                                    action: { ...editingAutomation.action!, entity: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                            >
                                                <option value="" disabled>Select Property</option>
                                                {(() => {
                                                    const device = devices.find(d => d.id === editingAutomation.action?.device_id)
                                                    if (!device) return null

                                                    const properties: { value: string, label: string }[] = []

                                                    // For Actions, we typically look for 'switch', 'light', 'cover', 'lock' or writeable primitives
                                                    // Z2M exposes often have access rights? We'll just list all writeable-looking things
                                                    device.exposes.forEach((exp: any) => {
                                                        // Check if access allows writing (usually defaults to assuming yes for top level actuators)
                                                        // But simplified: expose all
                                                        if (exp.features) {
                                                            exp.features.forEach((feat: any) => {
                                                                properties.push({ value: feat.property || feat.name, label: feat.label || feat.name || feat.property })
                                                            })
                                                        } else if (exp.type !== 'numeric' || (exp.access && (exp.access & 2))) {
                                                            // Numeric can be set (e.g. brightness), binary/switch/enum definitely
                                                            // Assuming access bit 2 is write (common in Z2M but check specs? let's just list all)
                                                            properties.push({ value: exp.property || exp.name, label: exp.label || exp.name || exp.property })
                                                        }
                                                    })

                                                    return properties.map(prop => (
                                                        <option key={prop.value} value={prop.value}>{prop.label}</option>
                                                    ))
                                                })()}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Value</label>
                                            <input
                                                type="text"
                                                value={editingAutomation.action?.value || ''}
                                                onChange={e => setEditingAutomation({
                                                    ...editingAutomation,
                                                    action: { ...editingAutomation.action!, value: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm"
                                                placeholder="e.g. ON, OFF, 25"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Layers className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Select an automation to edit</p>
                            <p className="text-sm">or create a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Layers(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
    )
}
