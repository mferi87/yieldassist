import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from "../api/client";
import { ArrowLeft, RefreshCw, Cpu, Activity, Signal, Eye, EyeOff, MoreHorizontal, X, Power, Save } from 'lucide-react'

interface ZigbeeDevice {
    id: string
    ieee_address: string
    friendly_name: string
    model: string
    vendor: string
    description: string
    exposes: any[]
    is_online: boolean
    is_tracked: boolean
    last_seen: string
    state: Record<string, any>
}

export default function ZigbeeDevicesPage() {
    const { hubId } = useParams()
    const [devices, setDevices] = useState<ZigbeeDevice[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedDevice, setSelectedDevice] = useState<ZigbeeDevice | null>(null)
    const [numericInputs, setNumericInputs] = useState<Record<string, string>>({})

    const fetchDevices = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await api.get(`/api/hubs/${hubId}/devices`)
            setDevices(response.data)
            // Update selected device if it's open, to get latest state
            if (selectedDevice) {
                const updated = response.data.find((d: ZigbeeDevice) => d.id === selectedDevice.id)
                if (updated) setSelectedDevice(updated)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch devices')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleTracking = async (device: ZigbeeDevice) => {
        try {
            const newStatus = !device.is_tracked
            // Optimistic update devices list
            setDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, is_tracked: newStatus } : d
            ))

            // Update selected device if open
            if (selectedDevice && selectedDevice.id === device.id) {
                setSelectedDevice(prev => prev ? { ...prev, is_tracked: newStatus } : null)
            }

            await api.put(`/api/devices/${device.id}`, {
                is_tracked: newStatus
            })
        } catch (err) {
            // Revert on error
            setDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, is_tracked: !device.is_tracked } : d
            ))
            if (selectedDevice && selectedDevice.id === device.id) {
                setSelectedDevice(prev => prev ? { ...prev, is_tracked: !device.is_tracked } : null)
            }
            console.error("Failed to toggle tracking", err)
            // alert("Failed to update tracking status")
        }
    }

    const sendCommand = async (property: string, value: any) => {
        if (!selectedDevice) return;

        try {
            // Optimistic update
            const updatedState = { ...selectedDevice.state, [property]: value }
            const updatedDevice = { ...selectedDevice, state: updatedState }

            setSelectedDevice(updatedDevice)
            setDevices(prev => prev.map(d => d.id === selectedDevice.id ? updatedDevice : d))

            await api.post(`/api/hubs/${hubId}/command`, {
                ieee_address: selectedDevice.ieee_address,
                payload: { [property]: value }
            })

        } catch (err) {
            console.error("Failed to send command", err)
            alert("Failed to send command")
            // Revert? simpler to just refresh or let next poll fix it
            fetchDevices()
        }
    }

    useEffect(() => {
        if (hubId) {
            fetchDevices()
        }
    }, [hubId])

    useEffect(() => {
        if (selectedDevice?.id && hubId) {
            // Auto-refresh state when opening device details
            api.post(`/api/hubs/${hubId}/command`, {
                ieee_address: selectedDevice.ieee_address,
                payload: {},
                mode: "get"
            }).then(() => {
                // Refresh data after a short delay to capture updated state
                setTimeout(() => {
                    fetchDevices()
                }, 2000)
            }).catch(err => console.error("Failed to auto-refresh state", err))
        }
    }, [selectedDevice?.id, hubId])

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Never'
        return new Date(dateString).toLocaleString()
    }

    // Helper to render value controls based on expose type
    const renderEntityControl = (expose: any) => {
        const property = expose.property || expose.name
        const value = selectedDevice?.state?.[property]

        // Check access: bit 2 is SET (write).
        const isReadOnly = (expose.access !== undefined) && ((expose.access & 2) === 0)

        // Read-only view - value is already shown above, so return null to avoid duplication
        if (isReadOnly) return null;

        // Switch / Binary
        if (expose.type === 'switch' || expose.type === 'binary') {
            const valOn = expose.value_on ?? 'ON';
            const valOff = expose.value_off ?? 'OFF';

            return (
                <div className="mt-3 flex gap-2">
                    <button
                        onClick={() => sendCommand(property, valOn)}
                        className={`flex-1 flex items-center justify-center py-1 text-xs border rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${value === valOn || value === true
                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                            }`}
                    >
                        <Power className="w-3 h-3 mr-1" />
                        ON
                    </button>
                    <button
                        onClick={() => sendCommand(property, valOff)}
                        className={`flex-1 flex items-center justify-center py-1 text-xs border rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${value === valOff || value === false
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                            }`}
                    >
                        <Power className="w-3 h-3 mr-1" />
                        OFF
                    </button>
                </div>
            )
        }

        // Numeric - Show input and Set button
        if (expose.type === 'numeric') {
            const inputKey = `${selectedDevice?.id}-${property}`
            const inputValue = numericInputs[inputKey] ?? value ?? ''

            const min = expose.value_min ?? 0
            const max = expose.value_max ?? 100
            const step = expose.value_step ?? 1

            return (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={inputValue || min}
                        onChange={(e) => setNumericInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                        onMouseUp={() => sendCommand(property, Number(inputValue || min))}
                        onTouchEnd={() => sendCommand(property, Number(inputValue || min))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                    />
                    <input
                        type="number"
                        value={inputValue}
                        onChange={(e) => setNumericInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                        className="w-20 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs dark:bg-gray-700 dark:text-white px-2 py-1 text-right"
                        placeholder={value?.toString()}
                        min={min}
                        max={max}
                        step={step}
                    />
                    <button
                        onClick={() => sendCommand(property, Number(inputValue))}
                        disabled={!inputValue}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <Save className="w-3 h-3" />
                    </button>
                </div>
            )
        }

        return null
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center mb-8">
                <Link to="/hubs" className="mr-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Zigbee Devices</h1>
                <button
                    onClick={fetchDevices}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="mb-8 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {isLoading && devices.length === 0 ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading devices...</p>
                </div>
            ) : devices.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <Cpu className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No devices found for this hub.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Pair devices on your hub to see them here.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto max-h-[calc(100vh-12rem)]">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Device
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Model / Vendor
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Track
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {devices.sort((a, b) => {
                                // 1. Tracked first
                                if (a.is_tracked && !b.is_tracked) return -1;
                                if (!a.is_tracked && b.is_tracked) return 1;

                                // 2. Alphabetical by friendly_name
                                return a.friendly_name.localeCompare(b.friendly_name);
                            }).map((device) => (
                                <tr key={device.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setSelectedDevice(device)}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {device.friendly_name}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {device.ieee_address}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{device.model}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{device.vendor}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${device.is_online
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                            }`}>
                                            {device.is_online ? 'Online' : 'Offline'}
                                        </span>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {formatDate(device.last_seen)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleTracking(device)
                                            }}
                                            className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-colors ${device.is_tracked
                                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                                                }`}
                                        >
                                            {device.is_tracked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            <span>{device.is_tracked ? 'Tracking' : 'Off'}</span>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <MoreHorizontal className="w-5 h-5 text-gray-400" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Device Details Modal */}
            {selectedDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDevice(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedDevice.friendly_name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{selectedDevice.ieee_address}</p>
                            </div>
                            <button onClick={() => setSelectedDevice(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Actions / Tracking */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tracking</span>
                                    <button
                                        onClick={() => toggleTracking(selectedDevice)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${selectedDevice.is_tracked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedDevice.is_tracked ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        // Send 'get' command
                                        api.post(`/api/hubs/${hubId}/command`, {
                                            ieee_address: selectedDevice.ieee_address,
                                            payload: {},
                                            mode: "get"
                                        }).then(() => {
                                            // alert("Refresh requested")
                                            // Wait for round trip (MQTT -> Agent -> WS -> Backend -> DB)
                                            // Using timeout to allow backend to process
                                            setTimeout(() => {
                                                fetchDevices()
                                            }, 2000)
                                        })
                                            .catch(err => console.error("Failed to refresh", err))
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Refresh State
                                </button>
                            </div>

                            {/* Entities / Exposes */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Entities</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {(function renderExposes(exposes: any[], pathPrefix: string = 'root') {
                                        return exposes?.flatMap((expose, idx) => {
                                            const currentPath = `${pathPrefix}-${idx}`
                                            if (expose.features) {
                                                return renderExposes(expose.features, currentPath)
                                            }

                                            const property = expose.property || expose.name
                                            // Handle cases where property might be nested or undefined
                                            if (!property) return null;

                                            const value = selectedDevice.state?.[property]

                                            return (
                                                <div key={currentPath} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase">{expose.label || property}</span>
                                                        {expose.access && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                                                                A:{expose.access}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 flex items-baseline">
                                                        <span className="text-lg font-medium text-gray-900 dark:text-white">
                                                            {value !== undefined && value !== null ? value.toString() : '-'}
                                                        </span>
                                                        {expose.unit && <span className="text-sm text-gray-500 ml-1">{expose.unit}</span>}
                                                    </div>

                                                    {/* Render Controls */}
                                                    {renderEntityControl(expose)}
                                                </div>
                                            )
                                        })
                                    })(selectedDevice.exposes || [])}
                                    {(!selectedDevice.exposes || selectedDevice.exposes.length === 0) && (
                                        <div className="col-span-full py-4 text-center text-sm text-gray-500">
                                            No entities exposed by this device.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Raw Data Preview */}
                            <div className="mt-6">
                                <details className="group">
                                    <summary className="flex items-center text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                                        <Activity className="w-4 h-4 mr-2" />
                                        Raw Device Data
                                    </summary>
                                    <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto text-gray-600 dark:text-gray-400">
                                        {JSON.stringify(selectedDevice, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
