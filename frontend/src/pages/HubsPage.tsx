import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useHubStore } from '../store/hubStore'
import { CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react'

export default function HubsPage() {
    const { hubs, fetchHubs, updateHubStatus, deleteHub, isLoading, error } = useHubStore()

    useEffect(() => {
        fetchHubs()
        const interval = setInterval(fetchHubs, 10000) // Poll every 10s for updates
        return () => clearInterval(interval)
    }, [fetchHubs])

    const handleDelete = async (hubId: string) => {
        if (confirm('Are you sure you want to delete this hub? This will also remove associated devices and automations.')) {
            await deleteHub(hubId)
        }
    }

    const pendingHubs = hubs.filter(h => h.status === 'pending')
    const approvedHubs = hubs.filter(h => h.status === 'approved')

    if (isLoading && hubs.length === 0) {
        return <div className="p-8 text-center text-gray-500">Loading hubs...</div>
    }

    // Get error from store
    if (error) {
        return <div className="p-8 text-center text-red-500">Error loading hubs: {error}</div>
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Hub Management</h1>

            {/* Pending Hubs */}
            {pendingHubs.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Approval</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pendingHubs.map(hub => (
                            <div key={hub.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-400">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{hub.name}</h3>
                                        <p className="text-sm text-gray-500">{hub.ip_address}</p>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Pending
                                    </span>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Last seen: {new Date(hub.last_seen || '').toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => updateHubStatus(hub.id, 'approved', hub.name)}
                                        className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => updateHubStatus(hub.id, 'ignored')}
                                        className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Ignore
                                    </button>
                                    <button
                                        onClick={() => handleDelete(hub.id)}
                                        className="p-2 text-red-600 hover:text-red-900 rounded hover:bg-red-50"
                                        title="Delete Hub"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Hubs */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Hubs</h2>
                {approvedHubs.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">No active hubs found</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {approvedHubs.map(hub => (
                            <div key={hub.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{hub.name}</h3>
                                        <p className="text-sm text-gray-500">{hub.ip_address}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hub.is_online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {hub.is_online ? 'Online' : 'Offline'}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(hub.id)}
                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                            title="Delete Hub"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Last seen: {new Date(hub.last_seen || '').toLocaleString()}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-center">
                                        <a href={`/hubs/${hub.id}/devices`} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                                            Manage Devices &rarr;
                                        </a>
                                        <a href={`/hubs/${hub.id}/automations`} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                                            Automations &rarr;
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
