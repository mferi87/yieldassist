import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Bed } from '../store/gardenStore'
import { Loader2, Plus, Edit, Eye } from 'lucide-react'

export default function BedsPage() {
    const { t } = useTranslation()
    const { gardenId } = useParams()
    const { currentGarden, beds, fetchGarden, fetchBeds, isLoading } = useGardenStore()
    const [selectedBed, setSelectedBed] = useState<Bed | null>(null)
    const [editMode, setEditMode] = useState<'view' | 'crops' | 'zones'>('view')

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
            fetchBeds(gardenId)
        }
    }, [gardenId, fetchGarden, fetchBeds])

    useEffect(() => {
        if (beds.length > 0 && !selectedBed) {
            setSelectedBed(beds[0])
        }
    }, [beds, selectedBed])

    if (isLoading && !currentGarden) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    const cellSize = 50 // 25cm per cell
    const gridWidth = selectedBed?.width_cells || 4
    const gridHeight = selectedBed?.height_cells || 8

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('bed.title')}</h1>
                    <p className="text-gray-500">{currentGarden?.name}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEditMode('view')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'view'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Eye className="w-4 h-4" />
                        View
                    </button>
                    <button
                        onClick={() => setEditMode('crops')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'crops'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Edit className="w-4 h-4" />
                        Crop Placement
                    </button>
                    <button
                        onClick={() => setEditMode('zones')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'zones'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Edit className="w-4 h-4" />
                        Zone Edit
                    </button>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Bed Selector */}
                <div className="w-64 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 shrink-0">
                    <h3 className="font-semibold text-gray-900 mb-4">Select Bed</h3>

                    {beds.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                            No beds available. Create beds in Overview.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {beds.map((bed) => (
                                <button
                                    key={bed.id}
                                    onClick={() => setSelectedBed(bed)}
                                    className={`w-full text-left p-3 rounded-xl transition-colors ${selectedBed?.id === bed.id
                                            ? 'bg-primary-100 border-2 border-primary-300'
                                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                        }`}
                                >
                                    <p className="font-medium text-gray-900">{bed.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {(bed.width_cells * 25) / 100}m × {(bed.height_cells * 25) / 100}m
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bed Grid */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    {selectedBed ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">{selectedBed.name}</h3>
                                <span className="text-sm text-gray-500">
                                    Each cell = 25cm × 25cm
                                </span>
                            </div>

                            <div
                                className="mx-auto border border-gray-200 rounded-lg overflow-hidden"
                                style={{
                                    width: gridWidth * cellSize,
                                    height: gridHeight * cellSize,
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
                                    gridTemplateRows: `repeat(${gridHeight}, ${cellSize}px)`,
                                }}
                            >
                                {Array.from({ length: gridWidth * gridHeight }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`border border-gray-100 flex items-center justify-center text-xs text-gray-300 transition-colors ${editMode !== 'view' ? 'hover:bg-primary-50 cursor-pointer' : ''
                                            }`}
                                    >
                                        {/* Placeholder for crops/zones */}
                                    </div>
                                ))}
                            </div>

                            {editMode === 'crops' && (
                                <p className="text-center text-sm text-gray-500 mt-4">
                                    Click on cells to place crops (coming soon)
                                </p>
                            )}

                            {editMode === 'zones' && (
                                <p className="text-center text-sm text-gray-500 mt-4">
                                    Draw zones for sensors and irrigation (coming soon)
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 text-gray-500">
                            Select a bed to view details
                        </div>
                    )}
                </div>

                {/* Right Panel (Edit Mode) */}
                {editMode !== 'view' && (
                    <div className="w-72 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 shrink-0">
                        {editMode === 'crops' && (
                            <>
                                <h3 className="font-semibold text-gray-900 mb-4">Crop Library</h3>
                                <div className="space-y-2">
                                    {['Tomato', 'Lettuce', 'Carrot', 'Pepper', 'Cucumber'].map((crop) => (
                                        <div
                                            key={crop}
                                            className="p-3 rounded-xl bg-gray-50 hover:bg-primary-50 cursor-pointer transition-colors"
                                        >
                                            <p className="font-medium text-gray-900">{crop}</p>
                                            <p className="text-xs text-gray-500">1×1 cell</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {editMode === 'zones' && (
                            <>
                                <h3 className="font-semibold text-gray-900 mb-4">Zone Editor</h3>
                                <button className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
                                    <Plus className="w-4 h-4" />
                                    New Zone
                                </button>
                                <p className="text-xs text-gray-500 mt-4">
                                    Zones group cells for sensor and irrigation control.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
