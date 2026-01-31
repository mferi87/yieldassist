import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'
import { ChevronDown, ChevronRight, CheckCircle, Clock, Cpu, Download, RefreshCw, Server, AlertCircle, Trash2, Zap, Edit2, Check, X, Loader2 } from 'lucide-react'

// Types
interface Sensor {
    id: string
    device_id: string
    sensor_type: string
    last_reading: { value: any }
    last_seen: string
    is_online: boolean
    peripheral_id?: string
}

interface Valve {
    id: string
    device_id: string
    is_open: boolean
    target_is_open: boolean | null
    last_activated: string | null
    peripheral_id?: string
}

interface Peripheral {
    id: string
    device_id: string
    name: string | null
    sensors: Sensor[]
    valves: Valve[]
}


interface Hub {
    id: string
    device_id: string
    name: string | null
    is_approved: boolean
    last_seen: string | null
    is_online: boolean
    uptime: number | null
    wifi_rssi: number | null
    sensors: Sensor[]
    valves: Valve[]
    peripherals: Peripheral[]
}

const DeviceGroup = ({ device, onToggleValve, onRename, titleOverride, forceOpen = false }: { device: Peripheral, onToggleValve: (id: string) => void, onRename: (id: string, name: string) => void, titleOverride?: string, forceOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(forceOpen)
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(device.name || '')

    // Use device name or ID, or titleOverride
    const displayName = titleOverride || device.name || `Device ${device.device_id}`

    // Combined list of entities (sensors and valves)
    const hasEntities = (device.sensors && device.sensors.length > 0) || (device.valves && device.valves.length > 0)

    if (!hasEntities) return null;

    return (
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-dark-surface/50">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                        <Cpu className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className="text-left flex-1">
                        {isEditing ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    autoFocus
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRename(device.id, editName)
                                        setIsEditing(false)
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsEditing(false)
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group/title">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{displayName}</h4>
                                {!titleOverride && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditName(device.name || '')
                                            setIsEditing(true)
                                        }}
                                        className="opacity-0 group-hover/title:opacity-100 p-1 text-gray-400 hover:text-primary-500 transition-opacity"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-gray-500">{device.sensors?.length || 0} sensors, {device.valves?.length || 0} actuators</p>
                    </div>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </div>

            {isOpen && (
                <div className="p-2 space-y-1">
                    {/* Valves First */}
                    {device.valves?.map(valve => (
                        <div key={valve.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group">
                            <div className="flex items-center gap-3 pl-2">
                                <div className={`w-2 h-2 rounded-full ${valve.is_open ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Valve {valve.device_id.split(':').pop()}</p>
                                    <p className="text-[10px] text-gray-400">Actuator • {valve.is_open ? 'Open' : 'Closed'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onToggleValve(valve.id)}
                                disabled={valve.target_is_open !== null}
                                className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-all flex items-center gap-2 ${valve.target_is_open !== null
                                    ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700'
                                    : valve.is_open
                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-transparent dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800'
                                    }`}
                            >
                                {valve.target_is_open !== null && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                )}
                                {valve.target_is_open !== null
                                    ? (valve.target_is_open ? 'Opening...' : 'Closing...')
                                    : (valve.is_open ? 'Close' : 'Open')}
                            </button>
                        </div>
                    ))}

                    {/* Sensors */}
                    {device.sensors?.map(sensor => (
                        <div key={sensor.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group">
                            <div className="flex items-center gap-3 pl-2">
                                <span className={`w-2 h-2 rounded-full ${sensor.is_online ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{sensor.sensor_type.replace('_', ' ')}</p>
                                    <p className="text-[10px] text-gray-400">Sensor • Last: {new Date(sensor.last_seen).toLocaleTimeString()}</p>
                                </div>
                            </div>
                            <div className="text-right pr-2">
                                <p className="font-mono font-bold text-gray-900 dark:text-white">
                                    {typeof sensor.last_reading?.value === 'number' ? sensor.last_reading.value.toFixed(1) : (sensor.last_reading?.value || '--')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function DevicesPage() {
    const { t } = useTranslation()
    const { token } = useAuthStore()
    const [myHubs, setMyHubs] = useState<Hub[]>([])
    const [pendingHubs, setPendingHubs] = useState<Hub[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedHub, setSelectedHub] = useState<Hub | null>(null) // For details modal

    const fetchHubs = async (background = false) => {
        if (!background) setLoading(true)
        setError(null)
        try {
            const res = await api.get('/api/hubs/my-hubs')
            const allHubs: Hub[] = res.data
            setPendingHubs(allHubs.filter(h => !h.is_approved))
            setMyHubs(allHubs.filter(h => h.is_approved))
        } catch (err) {
            console.error(err)
            setError('Failed to load devices')
        } finally {
            if (!background) setLoading(false)
        }
    }

    const handleApprove = async (hubId: string) => {
        try {
            await api.post('/api/hubs/approve', {
                hub_id: hubId,
                name: `My Hub ${hubId.slice(0, 4)}` // Default name
            })
            fetchHubs() // Refresh
        } catch (err) {
            console.error(err)
            setError('Failed to approve hub')
        }
    }

    const handleDelete = async (hubId: string) => {
        if (!confirm('Are you sure you want to remove this device?')) return
        try {
            await api.delete(`/api/hubs/${hubId}`)
            if (selectedHub?.id === hubId) setSelectedHub(null)
            fetchHubs()
            // If it was the mock device, the user might want to reset the ESP too
            // but that's out of scope for the web UI deletion.
        } catch (err) {
            console.error(err)
            setError('Failed to delete hub')
        }
    }

    const handleDownloadFirmware = () => {
        api.get('/api/firmware/download/esp8266', { responseType: 'blob' })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'yieldassist-esp8266-mock.bin');
                document.body.appendChild(link);
                link.click();
                link.remove();
            })
            .catch(err => {
                console.error(err)
                alert("Failed to download firmware. Backend might be building it, please try again in a few seconds.")
            })
    }

    const handleToggleValve = async (valveId: string) => {
        try {
            await api.post(`/api/valves/${valveId}/toggle`)
            fetchHubs()
        } catch (err) {
            console.error(err)
            alert('Failed to toggle valve')
        }
    }

    const handleRenamePeripheral = async (id: string, name: string) => {
        try {
            await api.patch(`/api/hubs/peripherals/${id}/name?name=${encodeURIComponent(name)}`)
            fetchHubs()
        } catch (err) {
            console.error(err)
            alert('Failed to rename device')
        }
    }

    useEffect(() => {
        if (selectedHub) {
            const updated = myHubs.find(h => h.id === selectedHub.id)
            if (updated) setSelectedHub(updated)
        }
    }, [myHubs])

    useEffect(() => {
        fetchHubs()
        const interval = setInterval(() => fetchHubs(true), 2000) // Poll every 2 seconds silently
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-bg overflow-y-auto relative">
            {/* Modal */}
            {selectedHub && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedHub(null)}>
                    <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedHub.name || selectedHub.device_id}</h3>
                                <p className="text-sm text-gray-500">Device ID: {selectedHub.device_id}</p>
                            </div>
                            <button onClick={() => setSelectedHub(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Grouped by Device (Peripheral) */}
                            {selectedHub.peripherals && selectedHub.peripherals.map(peripheral => (
                                <DeviceGroup
                                    key={peripheral.id}
                                    device={peripheral}
                                    onToggleValve={handleToggleValve}
                                    onRename={handleRenamePeripheral}
                                />
                            ))}

                            {/* Standalone Entities (Hub Sensors/Valves not in a peripheral) */}
                            {/* We need to filter sensors/valves that are NOT part of a peripheral if the backend duplicates them, 
                                but typically "top-level" lists might include everything or just direct ones. 
                                Assuming top-level 'sensors' and 'valves' lists in Hub object contain ALL, OR just direct.
                                Let's assume for now we render "Hub Entities" if there are any sensors/valves that usually attach directly to Hub (like onboard).
                                A safe bet is to check if we have sensors/valves that are conceptually "Device 0" or similar, 
                                but the current backend structure might replicate them in Peripherals.
                                
                                For this user request, 'sensors' and 'valves' on the Hub object are likely the FULL list. 
                                The 'peripherals' list contains the grouped ones. 
                                We should display peripherals, and then 'Hub Entities' for any remaining?
                                Actually, the user wants "Devices listed... click on arrow... see entities".
                                So we should iterate Peripherals. 
                                What about sensors NOT in a peripheral? We'll put them in a "Hub Entities" group.
                                
                                Optimization: The backend PeripheralResponse includes its sensors/valves.
                                We should rely on that for the groups.
                                If there are sensors in selectedHub.sensors that are NOT in any peripheral, we show them.
                                To keep it simple for now, we'll just show the Peripherals list 
                                and a "Hub / Main Unit" group for directly attached items if we can distinguish them.
                                
                                Update: The user said "on esp it is called unit, but I would like to call it device".
                                So 'unit' = 'peripheral'.
                            */}

                            {/* Calculated "Hub" group for sensors/valves that might not be in a peripheral object 
                                 (or if we just want to treat the Hub itself as a Device)
                             */}
                            <DeviceGroup
                                device={{
                                    id: 'hub_main',
                                    device_id: selectedHub.device_id,
                                    name: selectedHub.name || "Hub Main Unit",
                                    // Filter out sensors/valves that are already in peripherals to avoid duplication?
                                    // For now, let's assume the backend might send everything in top lists.
                                    // Let's rely on the lists.
                                    // Actually, to avoid complexity, let's just show 'peripherals'. 
                                    // BUT, we might have sensors directly on the Hub (like system stats?).
                                    // Let's render a "Hub Entities" group using the top-level arrays 
                                    // MINUS what's in peripherals? Or just render the top-level arrays as "All Entities" or "Hub Entities"?
                                    // The user request implies a hierarchy.

                                    // Let's create a "Hub Onboard" device for items not in peripherals
                                    sensors: selectedHub.sensors.filter(s => !s.peripheral_id),
                                    valves: selectedHub.valves.filter(v => !v.peripheral_id)
                                } as any}
                                onToggleValve={handleToggleValve}
                                onRename={() => { }} // Hub main unit rename not supported here yet (renames Hub itself?)
                                titleOverride="Hub Onboard"
                                forceOpen={true}
                            />
                        </div>

                        <div className="mt-8 flex justify-between items-center">
                            <Link
                                to={`/automations/${selectedHub.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-md shadow-primary-500/20"
                            >
                                <Zap className="w-4 h-4" />
                                Customize Automations
                            </Link>
                            <button onClick={() => setSelectedHub(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-none p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                        Device Management
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Manage your YieldAssist Hubs and Firmware.
                    </p>
                </div>

                {/* Firmware Section */}
                <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Cpu className="w-6 h-6 text-primary-500" />
                                ESP8266 Firmware
                            </h2>
                            <p className="mt-1 text-gray-600 dark:text-gray-400 max-w-xl">
                                Download the specialized firmware for your ESP8266 to act as a YieldAssist Hub.
                                This firmware supports Wi-Fi pairing and local sensor simulation.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleDownloadFirmware}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-primary-500/30"
                            >
                                <Download className="w-5 h-5" />
                                Download Firmware
                            </button>
                            <a
                                href="https://esptool.spacehuhn.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary-600 dark:text-primary-400 hover:underline text-center"
                            >
                                Flash online with ESPTool
                            </a>
                        </div>
                    </div>
                </div>

                {/* Approved Devices */}
                {myHubs.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            Active Devices
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myHubs.map(hub => (
                                <div key={hub.id} className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-sm border border-green-200 dark:border-green-900/30 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedHub(hub)}>
                                    <div className="absolute top-0 right-0 p-4 opacity-50">
                                        <Cpu className="w-16 h-16 text-green-100 dark:text-green-900/20 transform rotate-12" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900 dark:text-white hover:text-primary-500 transition-colors underline decoration-dotted underline-offset-4">{hub.name || hub.device_id}</h3>
                                                <p className="text-xs text-gray-500 font-mono mb-1">{hub.device_id}</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(hub.id); }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Remove Device"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${hub.is_online ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${hub.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                {hub.is_online ? 'Online' : 'Offline'}
                                            </span>
                                            {hub.is_online && hub.wifi_rssi !== null && (
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    RSSI: {hub.wifi_rssi} dBm
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                                            {hub.uptime !== null && (
                                                <p>Uptime: {Math.floor(hub.uptime / 3600)}h {Math.floor((hub.uptime % 3600) / 60)}m</p>
                                            )}
                                            {hub.last_seen && (
                                                <p>Last seen: {new Date(hub.last_seen).toLocaleString()}</p>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                            <p className="text-sm font-medium text-gray-500 mb-2">Live Status:</p>
                                            <div className="flex gap-2 flex-wrap items-center justify-between mt-2">
                                                {/* Summary pill */}
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300">
                                                    {hub.sensors ? hub.sensors.length : 0} Sensors Reported
                                                </span>
                                                <Link
                                                    to={`/automations/${hub.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded"
                                                >
                                                    <Zap className="w-3 h-3" />
                                                    Manage Automations
                                                </Link>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2 italic">
                                                Click card for sensor details
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Devices */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Pending Approval
                    </h2>

                    {loading && <div className="text-gray-500">Loading...</div>}

                    {!loading && pendingHubs.length === 0 && (
                        <div className="bg-white dark:bg-dark-surface rounded-xl p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Server className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No pending devices found.</p>
                            <p className="text-sm text-gray-400 mt-1">Connect your ESP8266 to WiFi and enter your email to see it here.</p>
                            <button onClick={fetchHubs} className="mt-4 text-primary-600 hover:underline flex items-center gap-1 mx-auto">
                                <RefreshCw className="w-4 h-4" /> Refresh
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingHubs.map(hub => (
                            <div key={hub.id} className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-sm border border-orange-200 dark:border-orange-900/30 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-50">
                                    <AlertCircle className="w-16 h-16 text-orange-100 dark:text-orange-900/20 transform rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{hub.device_id}</h3>
                                            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-4">Needs Approval</p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(hub.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Remove Device"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Last Seen:</span>
                                            <span className="text-gray-700 dark:text-gray-300 font-mono">Just now</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleApprove(hub.id)}
                                        className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium shadow-md transition-all"
                                    >
                                        Approve Device
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}
