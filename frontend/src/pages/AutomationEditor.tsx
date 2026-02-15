import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    useAutomationStore,
    type Automation,
    type AutomationTrigger,
    type AutomationCondition,
    type AutomationAction,
    type StateTrigger,
    type TimeTrigger,
    type TimePatternTrigger,
    type DeviceAction,
    type DelayAction,
    type ChooseAction,
    type IfAction,
    type ConditionAction,
    createEmptyStateTrigger,
    createEmptyTimeTrigger,
    createEmptyTimePatternTrigger,
    createEmptyCondition,
    createEmptyDeviceAction,
    createEmptyDelayAction,
    createEmptyChooseAction,
    createEmptyIfAction,
    createEmptyConditionAction,
} from '../store/automationStore'
import { useDeviceStore, type ZigbeeDevice } from '../store/deviceStore'
import { useHubStore } from '../store/hubStore'
import {
    Plus, Trash2, Save, ArrowLeft, Loader2,
    Zap, Filter, GripVertical,
    ToggleLeft, ToggleRight, Timer, GitBranch, AlertCircle, Pause, HelpCircle,
} from 'lucide-react'

// ────────────────────────────────────────────
// Helper: extract properties from Z2M exposes
// ────────────────────────────────────────────
function getDeviceProperties(device: ZigbeeDevice | undefined, writable = false) {
    if (!device) return []
    const props: { value: string; label: string }[] = []
    device.exposes?.forEach((exp: any) => {
        if (exp.features) {
            exp.features.forEach((f: any) => {
                if (!writable || !f.access || (f.access & 2))
                    props.push({ value: f.property || f.name, label: f.label || f.name || f.property })
            })
        } else if (exp.property || exp.name) {
            if (!writable || !exp.access || (exp.access & 2))
                props.push({ value: exp.property || exp.name, label: exp.label || exp.name || exp.property })
        }
    })
    return props
}

// Helper: find the expose metadata object for a given property name
function getExposeForProperty(device: ZigbeeDevice | undefined, propertyName: string): any | null {
    if (!device || !propertyName) return null
    for (const exp of (device.exposes || [])) {
        if (exp.features) {
            for (const f of exp.features) {
                if ((f.property || f.name) === propertyName) return f
            }
        }
        if ((exp.property || exp.name) === propertyName) return exp
    }
    return null
}

// Dynamic value input: renders dropdown for binary/enum, number for numeric, text fallback
function DynamicValueInput({ value, expose, onChange, className }: {
    value: any; expose: any | null; onChange: (val: any) => void; className?: string
}) {
    const baseClass = className || 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100'

    // Binary (switch) — dropdown with ON/OFF (or custom values)
    if (expose && (expose.type === 'binary' || expose.type === 'switch')) {
        const valOn = expose.value_on ?? 'ON'
        const valOff = expose.value_off ?? 'OFF'
        return (
            <select value={String(value)} onChange={e => onChange(e.target.value)} className={baseClass}>
                <option value="">Select</option>
                <option value={String(valOn)}>{String(valOn)}</option>
                <option value={String(valOff)}>{String(valOff)}</option>
            </select>
        )
    }

    // Enum — dropdown with all available values
    if (expose && expose.type === 'enum' && expose.values) {
        return (
            <select value={String(value)} onChange={e => onChange(e.target.value)} className={baseClass}>
                <option value="">Select</option>
                {expose.values.map((v: string) => <option key={v} value={v}>{v}</option>)}
            </select>
        )
    }

    // Numeric — number input with min/max/unit
    if (expose && expose.type === 'numeric') {
        const min = expose.value_min
        const max = expose.value_max
        const unit = expose.unit
        return (
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    value={value === '' ? '' : Number(value)}
                    onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    min={min}
                    max={max}
                    step={expose.value_step ?? 1}
                    className={baseClass}
                    placeholder={min !== undefined && max !== undefined ? `${min}–${max}` : 'Value'}
                />
                {unit && <span className="text-xs text-gray-400 shrink-0">{unit}</span>}
            </div>
        )
    }

    // Fallback — free text
    return (
        <input
            type="text"
            value={String(value)}
            onChange={e => onChange(isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}
            className={baseClass}
            placeholder="Value"
        />
    )
}

// ────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────
export default function AutomationEditor() {
    const { hubId } = useParams<{ hubId: string }>()
    const navigate = useNavigate()
    const { automations, fetchAutomations, createAutomation, updateAutomation, deleteAutomation, isLoading } = useAutomationStore()
    const { devices, fetchDevices } = useDeviceStore()
    const { hubs, fetchHubs } = useHubStore()

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [draft, setDraft] = useState<Omit<Automation, 'id'> | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    const hub = hubs.find(h => h.id === hubId)
    const hubDevices = devices.filter(d => d.hub_id === hubId)

    useEffect(() => {
        fetchHubs()
        fetchDevices()
        if (hubId) fetchAutomations(hubId)
    }, [hubId])

    // ── Handlers ──
    const startNew = () => {
        setDraft({
            hub_id: hubId || '',
            name: '',
            description: '',
            triggers: [createEmptyStateTrigger()],
            conditions: [],
            actions: [createEmptyDeviceAction()],
            enabled: true,
        })
        setSelectedId(null)
        setIsCreating(true)
    }

    const selectAutomation = (a: Automation) => {
        setDraft({ ...a })
        setSelectedId(a.id)
        setIsCreating(false)
    }

    const handleSave = async () => {
        if (!draft || !draft.name) return
        try {
            if (isCreating) {
                const created = await createAutomation(draft as Omit<Automation, 'id'>)
                setSelectedId(created.id)
                setIsCreating(false)
            } else if (selectedId) {
                await updateAutomation(selectedId, draft)
            }
            if (hubId) fetchAutomations(hubId)
        } catch (e) { console.error(e) }
    }

    const handleDelete = async () => {
        if (!selectedId) return
        if (!confirm('Delete this automation?')) return
        await deleteAutomation(selectedId)
        setDraft(null)
        setSelectedId(null)
    }

    // ── Update helpers ──
    const updateDraft = (patch: Partial<Omit<Automation, 'id'>>) => setDraft(d => d ? { ...d, ...patch } : null)
    const updateTrigger = (i: number, t: AutomationTrigger) => {
        if (!draft) return
        const triggers = [...draft.triggers]
        triggers[i] = t
        updateDraft({ triggers })
    }
    const removeTrigger = (i: number) => {
        if (!draft) return
        updateDraft({ triggers: draft.triggers.filter((_, idx) => idx !== i) })
    }
    const updateCondition = (i: number, c: AutomationCondition) => {
        if (!draft) return
        const conditions = [...draft.conditions]
        conditions[i] = c
        updateDraft({ conditions })
    }
    const removeCondition = (i: number) => {
        if (!draft) return
        updateDraft({ conditions: draft.conditions.filter((_, idx) => idx !== i) })
    }
    const updateAction = (i: number, a: AutomationAction) => {
        if (!draft) return
        const actions = [...draft.actions]
        actions[i] = a
        updateDraft({ actions })
    }
    const removeAction = (i: number) => {
        if (!draft) return
        updateDraft({ actions: draft.actions.filter((_, idx) => idx !== i) })
    }

    // ── Render ──
    return (
        <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/hubs')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-selected transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automations</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{hub?.name || 'Hub'}</p>
                </div>
                <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4" /> New Automation
                </button>
            </div>

            <div className="flex-1 min-h-0 flex gap-5">
                {/* ── LEFT: Automation List ── */}
                <div className="w-72 shrink-0 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-y-auto">
                    {isLoading && automations.length === 0 ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                    ) : automations.length === 0 && !isCreating ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <Zap className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No automations yet</p>
                            <button onClick={startNew} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Create one</button>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {automations.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => selectAutomation(a)}
                                    className={`w-full text-left p-3 rounded-xl transition-colors ${selectedId === a.id
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                        : 'hover:bg-gray-50 dark:hover:bg-dark-selected border border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${a.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{a.name}</span>
                                    </div>
                                    {a.description && <p className="text-xs text-gray-400 mt-1 truncate pl-4">{a.description}</p>}
                                    <p className="text-xs text-gray-400 mt-1 pl-4">{a.triggers.length} trigger{a.triggers.length !== 1 ? 's' : ''} · {a.actions.length} action{a.actions.length !== 1 ? 's' : ''}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Editor ── */}
                <div className="flex-1 overflow-y-auto">
                    {draft ? (
                        <div className="max-w-3xl space-y-6">
                            {/* Name / Enable / Save bar */}
                            <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        placeholder="Automation name..."
                                        value={draft.name}
                                        onChange={e => updateDraft({ name: e.target.value })}
                                        className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                    />
                                    <button
                                        onClick={() => updateDraft({ enabled: !draft.enabled })}
                                        className={`p-1.5 rounded-lg transition-colors ${draft.enabled ? 'text-green-500' : 'text-gray-400'}`}
                                        title={draft.enabled ? 'Enabled' : 'Disabled'}
                                    >
                                        {draft.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                    </button>
                                    {selectedId && <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                                    <button onClick={handleSave} disabled={!draft.name} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
                                        <Save className="w-4 h-4" /> Save
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Description (optional)"
                                    value={draft.description || ''}
                                    onChange={e => updateDraft({ description: e.target.value })}
                                    className="mt-2 w-full text-sm bg-transparent border-none outline-none text-gray-500 dark:text-gray-400 placeholder-gray-300 dark:placeholder-gray-600"
                                />
                            </div>

                            {/* ── WHEN (Triggers) ── */}
                            <Section title="When" icon={<Zap className="w-4 h-4" />} helpText="Any trigger will start the automation" color="amber">
                                {draft.triggers.map((trigger, i) => (
                                    <TriggerCard key={i} trigger={trigger} devices={hubDevices} onChange={t => updateTrigger(i, t)} onRemove={() => removeTrigger(i)} canRemove={draft.triggers.length > 1} />
                                ))}
                                <AddButton label="Add trigger" onClick={() => updateDraft({ triggers: [...draft.triggers, createEmptyStateTrigger()] })} />
                            </Section>

                            {/* ── AND IF (Conditions) ── */}
                            <Section title="And if" subtitle="(optional)" icon={<Filter className="w-4 h-4" />} helpText="All conditions must be met" color="purple">
                                {draft.conditions.map((cond, i) => (
                                    <ConditionCard key={i} condition={cond} devices={hubDevices} onChange={c => updateCondition(i, c)} onRemove={() => removeCondition(i)} />
                                ))}
                                <AddButton label="Add condition" onClick={() => updateDraft({ conditions: [...draft.conditions, createEmptyCondition()] })} />
                            </Section>

                            {/* ── THEN DO (Actions) ── */}
                            <Section title="Then do" icon={<Zap className="w-4 h-4" />} helpText="Actions run in sequence" color="green">
                                {draft.actions.map((action, i) => (
                                    <ActionCard key={i} action={action} devices={hubDevices} onChange={a => updateAction(i, a)} onRemove={() => removeAction(i)} canRemove={draft.actions.length > 1} />
                                ))}
                                <ActionAddMenu onAdd={(a) => updateDraft({ actions: [...draft.actions, a] })} />
                            </Section>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Zap className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Select an automation to edit</p>
                            <p className="text-sm">or create a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ────────────────────────────────────────────
// Section wrapper
// ────────────────────────────────────────────
function Section({ title, subtitle, icon, helpText, color, children }: {
    title: string; subtitle?: string; icon: React.ReactNode; helpText?: string; color: string; children: React.ReactNode
}) {
    const borderColors: Record<string, string> = { amber: 'border-l-amber-500', purple: 'border-l-purple-500', green: 'border-l-green-500' }
    return (
        <div className={`bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden border-l-4 ${borderColors[color] || ''}`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                    {subtitle && <span className="text-sm text-gray-400">{subtitle}</span>}
                </div>
                {helpText && (
                    <span className="text-xs text-gray-400 flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> {helpText}</span>
                )}
            </div>
            <div className="p-4 space-y-3">{children}</div>
        </div>
    )
}

// ────────────────────────────────────────────
// Trigger Card
// ────────────────────────────────────────────
function TriggerCard({ trigger, devices, onChange, onRemove, canRemove }: {
    trigger: AutomationTrigger; devices: ZigbeeDevice[]; onChange: (t: AutomationTrigger) => void; onRemove: () => void; canRemove: boolean
}) {
    const [triggerType, setTriggerType] = useState(trigger.type)

    const changeTriggerType = (type: string) => {
        setTriggerType(type as any)
        if (type === 'state') onChange(createEmptyStateTrigger())
        else if (type === 'time') onChange(createEmptyTimeTrigger())
        else if (type === 'time_pattern') onChange(createEmptyTimePatternTrigger())
    }

    return (
        <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative group">
            <div className="flex items-center gap-2 mb-3">
                <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                <select value={triggerType} onChange={e => changeTriggerType(e.target.value)} className="text-sm font-medium bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 cursor-pointer">
                    <option value="state">🔌 Device state change</option>
                    <option value="time">🕐 At a specific time</option>
                    <option value="time_pattern">🔄 Time pattern (periodic)</option>
                </select>
                {canRemove && <button onClick={onRemove} className="ml-auto p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>

            {trigger.type === 'state' && <StateTriggerFields trigger={trigger} devices={devices} onChange={onChange} />}
            {trigger.type === 'time' && <TimeTriggerFields trigger={trigger as TimeTrigger} onChange={onChange} />}
            {trigger.type === 'time_pattern' && <TimePatternFields trigger={trigger as TimePatternTrigger} onChange={onChange} />}
        </div>
    )
}

function StateTriggerFields({ trigger, devices, onChange }: { trigger: StateTrigger; devices: ZigbeeDevice[]; onChange: (t: AutomationTrigger) => void }) {
    const device = devices.find(d => d.ieee_address === trigger.device_id || d.friendly_name === trigger.device_id)
    const props = getDeviceProperties(device)
    const expose = getExposeForProperty(device, trigger.entity)

    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Device</label>
                <select value={trigger.device_id} onChange={e => onChange({ ...trigger, device_id: e.target.value, entity: '', value: '' })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100">
                    <option value="">Select device</option>
                    {devices.map(d => <option key={d.id} value={d.ieee_address}>{d.friendly_name || d.ieee_address}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Property</label>
                <select value={trigger.entity} onChange={e => onChange({ ...trigger, entity: e.target.value, value: '' })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100">
                    <option value="">Select property</option>
                    {props.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <div className="w-20">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Op</label>
                    <select value={trigger.operator} onChange={e => onChange({ ...trigger, operator: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100">
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
                    <DynamicValueInput value={trigger.value} expose={expose} onChange={v => onChange({ ...trigger, value: v })} />
                </div>
            </div>
        </div>
    )
}

function TimeTriggerFields({ trigger, onChange }: { trigger: TimeTrigger; onChange: (t: AutomationTrigger) => void }) {
    return (
        <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Time (HH:MM)</label>
            <input type="time" value={trigger.at?.substring(0, 5) || '06:00'} onChange={e => onChange({ ...trigger, at: e.target.value + ':00' })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100" />
        </div>
    )
}

function TimePatternFields({ trigger, onChange }: { trigger: TimePatternTrigger; onChange: (t: AutomationTrigger) => void }) {
    return (
        <div>
            <div className="flex gap-3 mb-2">
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hours</label>
                    <input type="text" value={trigger.hours ?? ''} onChange={e => onChange({ ...trigger, hours: e.target.value })} className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400" placeholder="*" />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Minutes</label>
                    <input type="text" value={trigger.minutes ?? ''} onChange={e => onChange({ ...trigger, minutes: e.target.value })} className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400" placeholder="/5" />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Seconds</label>
                    <input type="text" value={trigger.seconds ?? ''} onChange={e => onChange({ ...trigger, seconds: e.target.value })} className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400" placeholder="0" />
                </div>
            </div>
            <p className="text-xs text-gray-400">Use <code>*</code> for any, <code>/n</code> for every n, or specific numbers (e.g. <code>/15</code> for every 15 mins).</p>
        </div>
    )
}

// ────────────────────────────────────────────
// Condition Card
// ────────────────────────────────────────────
function ConditionCard({ condition, devices, onChange, onRemove }: {
    condition: AutomationCondition; devices: ZigbeeDevice[]; onChange: (c: AutomationCondition) => void; onRemove: () => void
}) {
    return (
        <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative group">
            <div className="flex items-center gap-2 mb-3">
                <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔌 Device state</span>
                <button onClick={onRemove} className="ml-auto p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <StateTriggerFields trigger={condition as StateTrigger} devices={devices} onChange={c => onChange(c as AutomationCondition)} />
        </div>
    )
}

// ────────────────────────────────────────────
// Action Card
// ────────────────────────────────────────────
function ActionCard({ action, devices, onChange, onRemove, canRemove }: {
    action: AutomationAction; devices: ZigbeeDevice[]; onChange: (a: AutomationAction) => void; onRemove: () => void; canRemove: boolean
}) {
    return (
        <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative group">
            <div className="flex items-center gap-2 mb-3">
                <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                <ActionTypeLabel type={action.type} />
                {canRemove && <button onClick={onRemove} className="ml-auto p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>

            {action.type === 'device_action' && <DeviceActionFields action={action} devices={devices} onChange={onChange} />}
            {action.type === 'delay' && <DelayFields action={action as DelayAction} onChange={onChange} />}
            {action.type === 'choose' && <ChooseFields action={action as ChooseAction} devices={devices} onChange={onChange} />}
            {action.type === 'if' && <IfFields action={action as IfAction} devices={devices} onChange={onChange} />}
            {action.type === 'condition' && <ConditionActionFields action={action as ConditionAction} devices={devices} onChange={onChange} />}
        </div>
    )
}

function ActionTypeLabel({ type }: { type: string }) {
    const labels: Record<string, { icon: React.ReactNode; label: string }> = {
        device_action: { icon: <Zap className="w-3.5 h-3.5 text-green-500" />, label: 'Device action' },
        delay: { icon: <Pause className="w-3.5 h-3.5 text-blue-500" />, label: 'Delay' },
        choose: { icon: <GitBranch className="w-3.5 h-3.5 text-orange-500" />, label: 'Choose' },
        if: { icon: <GitBranch className="w-3.5 h-3.5 text-purple-500" />, label: 'If-Then' },
        condition: { icon: <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />, label: 'Condition (stop if false)' },
    }
    const info = labels[type] || { icon: null, label: type }
    return <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">{info.icon} {info.label}</span>
}

function DeviceActionFields({ action, devices, onChange }: { action: DeviceAction; devices: ZigbeeDevice[]; onChange: (a: AutomationAction) => void }) {
    const device = devices.find(d => d.ieee_address === action.device_id || d.friendly_name === action.device_id)
    const props = getDeviceProperties(device, true)
    const expose = getExposeForProperty(device, action.entity)

    return (
        <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Device</label>
                <select value={action.device_id} onChange={e => onChange({ ...action, device_id: e.target.value, entity: '', value: '' })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100">
                    <option value="">Select device</option>
                    {devices.map(d => <option key={d.id} value={d.friendly_name || d.ieee_address}>{d.friendly_name || d.ieee_address}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Property</label>
                <select value={action.entity} onChange={e => onChange({ ...action, entity: e.target.value, value: '' })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-gray-900 dark:text-gray-100">
                    <option value="">Select</option>
                    {props.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
            </div>
            <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
                <DynamicValueInput value={action.value} expose={expose} onChange={v => onChange({ ...action, value: v })} />
            </div>
        </div>
    )
}

function DelayFields({ action, onChange }: { action: DelayAction; onChange: (a: AutomationAction) => void }) {
    const mins = Math.floor(action.seconds / 60)
    const secs = action.seconds % 60
    return (
        <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-blue-400" />
            <div className="flex items-center gap-2">
                <input type="number" min={0} value={mins} onChange={e => onChange({ ...action, seconds: (parseInt(e.target.value) || 0) * 60 + secs })} className="w-16 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-center text-gray-900 dark:text-gray-100" />
                <span className="text-sm text-gray-500">min</span>
            </div>
            <div className="flex items-center gap-2">
                <input type="number" min={0} max={59} value={secs} onChange={e => onChange({ ...action, seconds: mins * 60 + (parseInt(e.target.value) || 0) })} className="w-16 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-sm text-center text-gray-900 dark:text-gray-100" />
                <span className="text-sm text-gray-500">sec</span>
            </div>
        </div>
    )
}

function ChooseFields({ action, devices, onChange }: { action: ChooseAction; devices: ZigbeeDevice[]; onChange: (a: AutomationAction) => void }) {
    const updateChoice = (choiceIdx: number, patch: Partial<ChooseAction['choices'][0]>) => {
        const choices = [...action.choices]
        choices[choiceIdx] = { ...choices[choiceIdx], ...patch }
        onChange({ ...action, choices })
    }
    const addChoice = () => onChange({ ...action, choices: [...action.choices, { conditions: [createEmptyCondition()], sequence: [createEmptyDeviceAction()] }] })
    const removeChoice = (i: number) => onChange({ ...action, choices: action.choices.filter((_, idx) => idx !== i) })

    return (
        <div className="space-y-3">
            {action.choices.map((choice, i) => (
                <div key={i} className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Option {i + 1}</span>
                        {action.choices.length > 1 && <button onClick={() => removeChoice(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 mb-1 block">Conditions (all must be true):</span>
                        {choice.conditions.map((c, ci) => (
                            <div key={ci} className="mb-2">
                                <StateTriggerFields trigger={c as StateTrigger} devices={devices} onChange={newC => {
                                    const conds = [...choice.conditions]; conds[ci] = newC as AutomationCondition
                                    updateChoice(i, { conditions: conds })
                                }} />
                            </div>
                        ))}
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 mb-1 block">Actions:</span>
                        {choice.sequence.map((a, ai) => (
                            <div key={ai} className="mb-2">
                                <DeviceActionFields action={a as DeviceAction} devices={devices} onChange={newA => {
                                    const seq = [...choice.sequence]; seq[ai] = newA
                                    updateChoice(i, { sequence: seq })
                                }} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <button onClick={addChoice} className="text-xs text-orange-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add option</button>
        </div>
    )
}

function IfFields({ action, devices, onChange }: { action: IfAction; devices: ZigbeeDevice[]; onChange: (a: AutomationAction) => void }) {
    return (
        <div className="space-y-3">
            <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/40 rounded-lg p-3">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase mb-2 block">If conditions</span>
                {action.conditions.map((c, i) => (
                    <div key={i} className="mb-2">
                        <StateTriggerFields trigger={c as StateTrigger} devices={devices} onChange={newC => {
                            const conds = [...action.conditions]; conds[i] = newC as AutomationCondition
                            onChange({ ...action, conditions: conds })
                        }} />
                    </div>
                ))}
            </div>
            <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 rounded-lg p-3">
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase mb-2 block">Then</span>
                {action.then.map((a, i) => (
                    <div key={i} className="mb-2">
                        <DeviceActionFields action={a as DeviceAction} devices={devices} onChange={newA => {
                            const acts = [...action.then]; acts[i] = newA
                            onChange({ ...action, then: acts })
                        }} />
                    </div>
                ))}
            </div>
            {action.else.length > 0 && (
                <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase mb-2 block">Else</span>
                    {action.else.map((a, i) => (
                        <div key={i} className="mb-2">
                            <DeviceActionFields action={a as DeviceAction} devices={devices} onChange={newA => {
                                const acts = [...action.else]; acts[i] = newA
                                onChange({ ...action, else: acts })
                            }} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function ConditionActionFields({ action, devices, onChange }: { action: ConditionAction; devices: ZigbeeDevice[]; onChange: (a: AutomationAction) => void }) {
    return (
        <div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">⚠️ Stops the action sequence if conditions are not met</p>
            {action.conditions.map((c, i) => (
                <div key={i} className="mb-2">
                    <StateTriggerFields trigger={c as StateTrigger} devices={devices} onChange={newC => {
                        const conds = [...action.conditions]; conds[i] = newC as AutomationCondition
                        onChange({ ...action, conditions: conds })
                    }} />
                </div>
            ))}
        </div>
    )
}

// ────────────────────────────────────────────
// Add buttons
// ────────────────────────────────────────────
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> {label}
        </button>
    )
}

function ActionAddMenu({ onAdd }: { onAdd: (a: AutomationAction) => void }) {
    const [open, setOpen] = useState(false)
    const items = [
        { label: 'Device action', icon: <Zap className="w-4 h-4 text-green-500" />, factory: createEmptyDeviceAction },
        { label: 'Choose', icon: <GitBranch className="w-4 h-4 text-orange-500" />, factory: createEmptyChooseAction },
        { label: 'If-Then', icon: <GitBranch className="w-4 h-4 text-purple-500" />, factory: createEmptyIfAction },
        { label: 'Condition (stop)', icon: <AlertCircle className="w-4 h-4 text-yellow-500" />, factory: createEmptyConditionAction },
        { label: 'Delay', icon: <Pause className="w-4 h-4 text-blue-500" />, factory: createEmptyDelayAction },
    ]

    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 font-medium hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add action
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 bottom-full mb-1 z-50 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-1 w-56">
                        {items.map(item => (
                            <button key={item.label} onClick={() => { onAdd(item.factory()); setOpen(false) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-selected">
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
