import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Garden } from '../store/gardenStore'
import { Plus, Sprout, Loader2, ArrowRight, X, Settings, Trash2, Upload } from 'lucide-react'
import { api } from '../api/client'

export default function GardensPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { gardens, fetchGardens, createGarden, updateGarden, deleteGarden, isLoading } = useGardenStore()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newGarden, setNewGarden] = useState({ name: '', width_meters: 10, height_meters: 10 })

    useEffect(() => {
        fetchGardens()
    }, [fetchGardens])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const garden = await createGarden(newGarden)
            setShowCreateModal(false)
            setNewGarden({ name: '', width_meters: 10, height_meters: 10 })
            navigate(`/garden/${garden.id}`)
        } catch {
            // Error handled in store
        }
    }

    return (
        <div className="h-full overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('garden.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and plan your gardens</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-200 dark:shadow-primary-900 transition-all"
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
                        <Sprout className="w-10 h-10 text-primary-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No gardens yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">{t('garden.empty')}</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
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
                        <GardenCard
                            key={garden.id}
                            garden={garden}
                            onUpdate={updateGarden}
                            onDelete={deleteGarden}
                        />
                    ))}
                </div>
            )}

            {/* Create Garden Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('garden.create')}</h2>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('garden.name')}
                                </label>
                                <input
                                    type="text"
                                    value={newGarden.name}
                                    onChange={(e) => setNewGarden({ ...newGarden, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
                                    placeholder="My Backyard Garden"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('garden.width')}
                                    </label>
                                    <input
                                        type="number"
                                        value={newGarden.width_meters}
                                        onChange={(e) => setNewGarden({ ...newGarden, width_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
                                        min={1}
                                        max={100}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('garden.height')}
                                    </label>
                                    <input
                                        type="number"
                                        value={newGarden.height_meters}
                                        onChange={(e) => setNewGarden({ ...newGarden, height_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
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

interface GardenCardProps {
    garden: Garden
    onUpdate: (id: string, data: Partial<Garden>) => Promise<void>
    onDelete: (id: string) => Promise<void>
}

function GardenCard({ garden, onUpdate, onDelete }: GardenCardProps) {
    const navigate = useNavigate()
    const [showEditModal, setShowEditModal] = useState(false)
    const [editForm, setEditForm] = useState({
        name: garden.name,
        width_meters: garden.width_meters,
        height_meters: garden.height_meters,
        preview_image: garden.preview_image || ''
    })
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const img = new Image()
            img.onload = () => {
                // Resize to max 600x600 to save space
                const maxWidth = 600
                const maxHeight = 600
                let { width, height } = img

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height)
                    width = Math.round(width * ratio)
                    height = Math.round(height * ratio)
                }

                // Draw to canvas and compress as JPEG
                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)

                // Convert to compressed JPEG (0.7 quality)
                const compressedImage = canvas.toDataURL('image/jpeg', 0.7)
                setEditForm({ ...editForm, preview_image: compressedImage })
            }
            img.src = URL.createObjectURL(file)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onUpdate(garden.id, editForm)
            setShowEditModal(false)
        } catch {
            // Error handled in store
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        setIsSaving(true)
        try {
            await onDelete(garden.id)
        } catch {
            // Error handled in store
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <div className="group bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-700 transition-all overflow-hidden">
                {/* Garden Preview */}
                <div
                    onClick={() => navigate(`/garden/${garden.id}`)}
                    className="h-40 bg-gradient-to-br from-primary-50 to-earth-50 dark:from-dark-bg dark:to-dark-bg flex items-center justify-center relative cursor-pointer"
                >
                    {garden.preview_image ? (
                        <img
                            src={garden.preview_image}
                            alt={garden.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center text-gray-400">
                            <Sprout className="w-12 h-12 mb-2" />
                            <span className="text-xs">No preview</span>
                        </div>
                    )}
                </div>

                {/* Garden Info */}
                <div className="p-4">
                    {/* Row 1: Name + Arrow + Settings */}
                    <div className="flex items-center justify-between gap-2">
                        <h3
                            onClick={() => navigate(`/garden/${garden.id}`)}
                            className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 transition-colors cursor-pointer flex-1 truncate"
                        >
                            {garden.name}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {garden.role === 'admin' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowEditModal(true)
                                    }}
                                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-dark-bg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Settings className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                            <button
                                onClick={() => navigate(`/garden/${garden.id}`)}
                                className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
                            >
                                <ArrowRight className="w-4 h-4 text-primary-500" />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Size + Role Badge */}
                    <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {garden.width_meters}m × {garden.height_meters}m
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${garden.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' :
                            garden.role === 'editor' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                            {garden.role}
                        </span>
                    </div>
                </div>
            </div>

            {/* Edit Garden Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
                    <div className="relative bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => setShowEditModal(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Edit Garden</h2>

                        <div className="space-y-4">
                            {/* Preview Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Preview Image
                                </label>
                                <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-4 text-center">
                                    {editForm.preview_image ? (
                                        <div className="relative inline-block">
                                            <img
                                                src={editForm.preview_image}
                                                alt="Preview"
                                                className="max-h-32 rounded-lg"
                                            />
                                            <button
                                                onClick={() => setEditForm({ ...editForm, preview_image: '' })}
                                                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <span className="text-sm text-gray-500">Click to upload</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Garden Name
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            {/* Dimensions */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Width (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={editForm.width_meters}
                                        onChange={(e) => setEditForm({ ...editForm, width_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
                                        min={1}
                                        max={100}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Height (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={editForm.height_meters}
                                        onChange={(e) => setEditForm({ ...editForm, height_meters: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all outline-none text-gray-900 dark:text-gray-100"
                                        min={1}
                                        max={100}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                </button>
                            </div>

                            {/* Delete Section */}
                            <div className="border-t pt-4 mt-4">
                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-full py-2 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Garden
                                    </button>
                                ) : (
                                    <div className="bg-red-50 rounded-xl p-4">
                                        <p className="text-sm text-red-700 mb-3">
                                            Are you sure? This will permanently delete this garden and all its beds.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                className="flex-1 py-2 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleDelete}
                                                disabled={isSaving}
                                                className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
