import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Bed } from '../store/gardenStore'
import { useCropStore, type CropPlacement } from '../store/cropStore'
import { Edit, Eye, Plus, Loader2, ArrowLeft, GripVertical, X, Pencil, Trash2 } from 'lucide-react'

import { getCropEmoji } from '../utils/cropUtils'

export default function OverviewPage() {
    const { t } = useTranslation()
    const { gardenId } = useParams()
    const navigate = useNavigate()
    const { currentGarden, beds, fetchGarden, fetchBeds, createBed, updateBed, deleteBed, isLoading } = useGardenStore()
    const { gardenPlacements, fetchGardenPlacements } = useCropStore()
    const [isEditMode, setIsEditMode] = useState(false)
    const [showBedPanel, setShowBedPanel] = useState(false)
    const [showBedModal, setShowBedModal] = useState(false)
    const [editingBed, setEditingBed] = useState<Bed | null>(null)
    const [deletingBed, setDeletingBed] = useState<Bed | null>(null)
    const [deleteConfirmName, setDeleteConfirmName] = useState('')
    const [newBed, setNewBed] = useState({ name: '', width_m: 1, height_m: 2 })

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
            fetchBeds(gardenId)
            fetchGardenPlacements(gardenId)
        }
    }, [gardenId, fetchGarden, fetchBeds, fetchGardenPlacements])

    // Group placements by bed
    const placementsByBed = useMemo(() => {
        const grouped: Record<string, CropPlacement[]> = {}
        for (const placement of gardenPlacements) {
            if (!grouped[placement.bed_id]) {
                grouped[placement.bed_id] = []
            }
            grouped[placement.bed_id].push(placement)
        }
        return grouped
    }, [gardenPlacements])

    const handleAddBed = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!gardenId) return
        await createBed({
            garden_id: gardenId,
            name: newBed.name || `Bed ${beds.length + 1}`,
            width_cells: newBed.width_m * 4,  // 4 cells per meter (25cm each)
            height_cells: newBed.height_m * 4,
            position_x: 0,
            position_y: 0,
        })
        setShowBedModal(false)
        setEditingBed(null)
        setNewBed({ name: '', width_m: 1, height_m: 2 })
    }

    const handleEditBed = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingBed) return
        await updateBed(editingBed.id, {
            name: newBed.name || editingBed.name,
            width_cells: newBed.width_m * 4,
            height_cells: newBed.height_m * 4,
        })
        setEditingBed(null)
        setNewBed({ name: '', width_m: 1, height_m: 2 })
    }

    const handleDeleteBed = async () => {
        if (!deletingBed || deleteConfirmName !== deletingBed.name) return
        await deleteBed(deletingBed.id)
        setDeletingBed(null)
        setDeleteConfirmName('')
    }

    const openEditModal = (bed: Bed) => {
        setEditingBed(bed)
        setNewBed({
            name: bed.name,
            width_m: (bed.width_cells * 25) / 100,
            height_m: (bed.height_cells * 25) / 100,
        })
    }

    const handleBedDrag = (bedId: string, x: number, y: number) => {
        updateBed(bedId, { position_x: x, position_y: y })
    }

    if (isLoading && !currentGarden) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    if (!currentGarden) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Garden not found</p>
                <button onClick={() => navigate('/')} className="mt-4 text-primary-600 hover:underline">
                    Back to gardens
                </button>
            </div>
        )
    }

    // Grid is 0.5m per cell (2 cells per meter)
    const gridCols = currentGarden.width_meters * 2
    const gridRows = currentGarden.height_meters * 2
    const cellSize = Math.min(40, Math.floor(800 / Math.max(gridCols, gridRows)))

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{currentGarden.name}</h1>
                        <p className="text-gray-500">
                            {currentGarden.width_meters}m × {currentGarden.height_meters}m • {beds.length} beds
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setIsEditMode(!isEditMode)
                        setShowBedPanel(!isEditMode)
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isEditMode
                        ? 'bg-primary-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                        }`}
                >
                    {isEditMode ? (
                        <>
                            <Eye className="w-5 h-5" />
                            {t('overview.viewMode')}
                        </>
                    ) : (
                        <>
                            <Edit className="w-5 h-5" />
                            {t('overview.editMode')}
                        </>
                    )}
                </button>
            </div>

            <div className="flex gap-6">
                {/* Left Panel - Bed List (Edit Mode) */}
                {showBedPanel && (
                    <div className="w-64 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">Beds</h3>
                            <button
                                onClick={() => setShowBedModal(true)}
                                className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {beds.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                                No beds yet. Create one to get started!
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {beds.map((bed) => (
                                    <div
                                        key={bed.id}
                                        className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-primary-50 transition-colors group"
                                    >
                                        <div
                                            className="cursor-grab"
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('bedId', bed.id)
                                            }}
                                        >
                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer hover:text-primary-600"
                                            onClick={() => navigate(`/garden/${gardenId}/beds?bed=${bed.id}`)}
                                        >
                                            <p className="font-medium text-gray-900 text-sm truncate hover:text-primary-600">{bed.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {(bed.width_cells * 25) / 100}m × {(bed.height_cells * 25) / 100}m
                                            </p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(bed)}
                                                className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-600 transition-colors"
                                                title="Edit bed"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingBed(bed)}
                                                className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                                                title="Delete bed"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="text-xs text-gray-400 mt-4 text-center">
                            {t('overview.dragBeds')}
                        </p>
                    </div>
                )}

                {/* Garden Grid */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-auto">
                    <div
                        className="relative mx-auto"
                        style={{
                            width: gridCols * cellSize,
                            height: gridRows * cellSize,
                            backgroundImage: `
                                linear-gradient(to right, #9ca3af 1px, transparent 1px),
                                linear-gradient(to bottom, #9ca3af 1px, transparent 1px),
                                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                            `,
                            backgroundSize: `${cellSize * 2}px ${cellSize * 2}px, ${cellSize * 2}px ${cellSize * 2}px, ${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px`,
                            backgroundColor: '#fafafa',
                            borderRadius: '8px',
                            border: '1px solid #9ca3af',
                        }}
                        onDragOver={(e) => {
                            if (isEditMode) {
                                e.preventDefault()
                            }
                        }}
                        onDrop={(e) => {
                            if (!isEditMode) return
                            e.preventDefault()
                            const bedId = e.dataTransfer.getData('bedId')
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = Math.floor((e.clientX - rect.left) / cellSize)
                            const y = Math.floor((e.clientY - rect.top) / cellSize)
                            handleBedDrag(bedId, x, y)
                        }}
                    >
                        {/* Beds */}
                        {beds.map((bed) => (
                            <BedComponent
                                key={bed.id}
                                bed={bed}
                                cellSize={cellSize}
                                isEditMode={isEditMode}
                                placements={placementsByBed[bed.id] || []}
                                onBedClick={(bedId) => navigate(`/garden/${gardenId}/beds?bed=${bedId}`)}
                            />
                        ))}
                    </div>

                    {/* Grid legend */}
                    <div className="mt-4 text-center text-sm text-gray-500">
                        Each cell = 0.5m × 0.5m
                    </div>
                </div>
            </div>

            {/* Create Bed Modal */}
            {showBedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBedModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => setShowBedModal(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('bed.create')}</h2>

                        <form onSubmit={handleAddBed} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('bed.name')}
                                </label>
                                <input
                                    type="text"
                                    value={newBed.name}
                                    onChange={(e) => setNewBed({ ...newBed, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                    placeholder={`Bed ${beds.length + 1}`}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Width (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={newBed.width_m}
                                        onChange={(e) => setNewBed({ ...newBed, width_m: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={0.25}
                                        max={10}
                                        step={0.25}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Height (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={newBed.height_m}
                                        onChange={(e) => setNewBed({ ...newBed, height_m: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={0.25}
                                        max={10}
                                        step={0.25}
                                        required
                                    />
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Bed size: {newBed.width_m}m × {newBed.height_m}m = {(newBed.width_m * newBed.height_m).toFixed(2)} m²
                            </p>

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

            {/* Edit Bed Modal */}
            {editingBed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setEditingBed(null); setNewBed({ name: '', width_m: 1, height_m: 2 }); }} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => { setEditingBed(null); setNewBed({ name: '', width_m: 1, height_m: 2 }); }}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('common.edit')} {editingBed.name}</h2>

                        <form onSubmit={handleEditBed} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('bed.name')}
                                </label>
                                <input
                                    type="text"
                                    value={newBed.name}
                                    onChange={(e) => setNewBed({ ...newBed, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                    placeholder={editingBed.name}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Width (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={newBed.width_m}
                                        onChange={(e) => setNewBed({ ...newBed, width_m: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={0.25}
                                        max={10}
                                        step={0.25}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Height (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={newBed.height_m}
                                        onChange={(e) => setNewBed({ ...newBed, height_m: Number(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                                        min={0.25}
                                        max={10}
                                        step={0.25}
                                        required
                                    />
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Bed size: {newBed.width_m}m × {newBed.height_m}m = {(newBed.width_m * newBed.height_m).toFixed(2)} m²
                            </p>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingBed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setDeletingBed(null); setDeleteConfirmName(''); }} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <button
                            onClick={() => { setDeletingBed(null); setDeleteConfirmName(''); }}
                            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">{t('common.delete')} Bed</h2>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-4">
                            To delete <strong>"{deletingBed.name}"</strong>, please type the bed name to confirm:
                        </p>

                        <input
                            type="text"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all outline-none mb-4"
                            placeholder={deletingBed.name}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setDeletingBed(null); setDeleteConfirmName(''); }}
                                className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteBed}
                                disabled={deleteConfirmName !== deletingBed.name || isLoading}
                                className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function BedComponent({
    bed,
    cellSize,
    isEditMode,
    placements,
    onBedClick,
}: {
    bed: Bed
    cellSize: number
    isEditMode: boolean
    placements: CropPlacement[]
    onBedClick?: (bedId: string) => void
}) {
    // Convert cells to meters (25cm per cell = 0.25m)
    const widthM = (bed.width_cells * 25) / 100
    const heightM = (bed.height_cells * 25) / 100
    // Grid is 0.5m per cell, so multiply by 2 to convert meters to grid cells
    const gridWidthCells = widthM * 2
    const gridHeightCells = heightM * 2

    // Calculate bed pixel dimensions
    const bedWidth = gridWidthCells * cellSize
    const bedHeight = gridHeightCells * cellSize

    return (
        <div
            className={`absolute rounded-lg border-2 transition-all overflow-hidden ${isEditMode
                ? 'border-primary-400 bg-primary-100/80 cursor-move hover:border-primary-500'
                : 'border-earth-400 bg-earth-100/80'
                }`}
            style={{
                left: bed.position_x * cellSize,
                top: bed.position_y * cellSize,
                width: bedWidth,
                height: bedHeight,
            }}
            draggable={isEditMode}
            onDragStart={(e) => {
                e.dataTransfer.setData('bedId', bed.id)
            }}
        >
            {/* Miniature crop placements */}
            {placements.map((placement) => {
                // Scale factor: overview cell = 0.5m = 2 bed cells (25cm each)
                // So 1 bed cell = 0.25m = 0.5 overview cells
                // Subtract 4px from dimensions to account for border-2 (2px on each side)
                const scaleX = (bedWidth - 4) / bed.width_cells
                const scaleY = (bedHeight - 4) / bed.height_cells

                return (
                    <div
                        key={placement.id}
                        className="absolute flex flex-wrap items-center justify-center opacity-80"
                        style={{
                            left: placement.position_x * scaleX,
                            top: placement.position_y * scaleY,
                            width: placement.width_cells * scaleX,
                            height: placement.height_cells * scaleY,
                            backgroundColor: 'rgba(255,255,255,0.4)',
                            borderRadius: 2,
                        }}
                    >
                        <span style={{ fontSize: Math.min(scaleX, scaleY, 16) }}>
                            {getCropEmoji(placement.crop)}
                        </span>
                    </div>
                )
            })}

            {/* Bed name label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                    className={`text-xs font-medium text-earth-700 bg-white/90 px-1.5 py-0.5 rounded shadow-sm pointer-events-auto ${!isEditMode ? 'cursor-pointer hover:bg-white hover:text-primary-600' : ''}`}
                    onClick={(e) => {
                        if (!isEditMode && onBedClick) {
                            e.stopPropagation()
                            onBedClick(bed.id)
                        }
                    }}
                >
                    {bed.name}
                </span>
            </div>
        </div>
    )
}
