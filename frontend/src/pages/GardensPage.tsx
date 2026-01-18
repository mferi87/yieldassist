import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Garden } from '../store/gardenStore'
import { Plus, Sprout, Loader2, ArrowRight, X } from 'lucide-react'

export default function GardensPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { gardens, fetchGardens, createGarden, isLoading } = useGardenStore()
    const [showModal, setShowModal] = useState(false)
    const [newGarden, setNewGarden] = useState({ name: '', width_meters: 10, height_meters: 10 })

    useEffect(() => {
        fetchGardens()
    }, [fetchGardens])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const garden = await createGarden(newGarden)
            setShowModal(false)
            setNewGarden({ name: '', width_meters: 10, height_meters: 10 })
            navigate(`/garden/${garden.id}`)
        } catch {
            // Error handled in store
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('garden.title')}</h1>
                    <p className="text-gray-500 mt-1">Manage and plan your gardens</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-200 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    {t('garden.create')}
                </button>
            </div>

            {/* Loading State */}
            {isLoading && gardens.length === 0 && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
            )}

            {/* Empty State */}
            {!isLoading && gardens.length === 0 && (
                <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 mb-4">
                        <Sprout className="w-10 h-10 text-primary-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No gardens yet</h3>
                    <p className="text-gray-500 mb-6">{t('garden.empty')}</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        {t('garden.create')}
                    </button>
                </div>
            )}

            {/* Garden Grid */}
            {gardens.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gardens.map((garden) => (
                        <GardenCard key={garden.id} garden={garden} />
                    ))}
                </div>
            )}

            {/* Create Garden Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('garden.create')}</h2>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('garden.name')}
                                </label>
                                <input
                                    type="text"
                                    value={newGarden.name}
                                    onChange={(e) => setNewGarden({ ...newGarden, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                    placeholder="My Backyard Garden"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('garden.width')}
                                    </label>
                                    <input
                                        type="number"
                                        value={newGarden.width_meters}
                                        onChange={(e) => setNewGarden({ ...newGarden, width_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={1}
                                        max={100}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('garden.height')}
                                    </label>
                                    <input
                                        type="number"
                                        value={newGarden.height_meters}
                                        onChange={(e) => setNewGarden({ ...newGarden, height_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={1}
                                        max={100}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.create')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function GardenCard({ garden }: { garden: Garden }) {
    const navigate = useNavigate()

    return (
        <div
            onClick={() => navigate(`/garden/${garden.id}`)}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-200 transition-all cursor-pointer overflow-hidden"
        >
            {/* Garden Preview */}
            <div className="h-40 bg-gradient-to-br from-primary-50 to-earth-50 flex items-center justify-center relative">
                <div
                    className="absolute inset-4 border-2 border-dashed border-primary-200 rounded-lg"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(garden.width_meters, 10)}, 1fr)`,
                        gridTemplateRows: `repeat(${Math.min(garden.height_meters, 10)}, 1fr)`,
                        gap: '2px',
                    }}
                >
                    {Array.from({ length: Math.min(garden.width_meters * garden.height_meters, 100) }).map((_, i) => (
                        <div key={i} className="bg-primary-100/50 rounded-sm" />
                    ))}
                </div>
            </div>

            {/* Garden Info */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                            {garden.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {garden.width_meters}m × {garden.height_meters}m
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <ArrowRight className="w-5 h-5 text-primary-500" />
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${garden.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            garden.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                        }`}>
                        {garden.role}
                    </span>
                </div>
            </div>
        </div>
    )
}
