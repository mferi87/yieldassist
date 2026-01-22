import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Bed } from '../store/gardenStore'
import { useCropStore, type Crop, type CropPlacement } from '../store/cropStore'
import { useThemeStore } from '../store/themeStore'
import { Loader2, Plus, Edit, Eye, Trash2, Settings, RotateCw } from 'lucide-react'

// Color palette for crops
const CROP_COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
]

function getCropColor(cropId: string): string {
    let hash = 0
    for (let i = 0; i < cropId.length; i++) {
        hash = cropId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return CROP_COLORS[Math.abs(hash) % CROP_COLORS.length]
}

import { getCropEmoji, isBase64Image } from '../utils/cropUtils'

export default function BedsPage() {
    const { t } = useTranslation()
    const { gardenId } = useParams()
    const [searchParams] = useSearchParams()
    const { currentGarden, beds, fetchGarden, fetchBeds, isLoading } = useGardenStore()
    const { crops, placements, fetchCrops, fetchPlacements, createPlacement, deletePlacement, updatePlacement } = useCropStore()
    const { isDark } = useThemeStore()
    const [selectedBed, setSelectedBed] = useState<Bed | null>(null)
    const [editMode, setEditMode] = useState<'view' | 'crops' | 'zones'>('view')
    const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null)
    const [selectedPlacement, setSelectedPlacement] = useState<CropPlacement | null>(null)

    // Local state for editing spacing in popup
    const [editSpacing, setEditSpacing] = useState<string>('')
    const [editRowSpacing, setEditRowSpacing] = useState<string>('')

    const [customSpacing, setCustomSpacing] = useState<number | null>(null)
    const [customRowSpacing, setCustomRowSpacing] = useState<number | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
    const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null)
    const [hoveredPlacement, setHoveredPlacement] = useState<CropPlacement | null>(null)
    const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
    const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
            fetchBeds(gardenId)
            fetchCrops()
        }
    }, [gardenId, fetchGarden, fetchBeds, fetchCrops])

    // Get bed ID from URL
    const urlBedId = searchParams.get('bed')

    // Apply URL parameter when it changes (navigate to specific bed)
    useEffect(() => {
        if (urlBedId && beds.length > 0) {
            const targetBed = beds.find(b => b.id === urlBedId)
            if (targetBed && (!selectedBed || selectedBed.id !== urlBedId)) {
                setSelectedBed(targetBed)
            }
        }
    }, [urlBedId, beds]) // Only depends on URL and beds loading

    // Default to first bed if none selected
    useEffect(() => {
        if (beds.length > 0 && !selectedBed && !urlBedId) {
            setSelectedBed(beds[0])
        }
    }, [beds, selectedBed, urlBedId])

    useEffect(() => {
        if (selectedBed) {
            fetchPlacements(selectedBed.id)
        }
    }, [selectedBed, fetchPlacements])

    // Sync editing state when selectedPlacement changes
    useEffect(() => {
        if (selectedPlacement) {
            setEditSpacing(String(selectedPlacement.custom_spacing_cm ?? selectedPlacement.crop.spacing_cm))
            setEditRowSpacing(String(selectedPlacement.custom_row_spacing_cm ?? selectedPlacement.crop.row_spacing_cm))
        }
    }, [selectedPlacement])

    useEffect(() => {
        if (selectedCrop) {
            setCustomSpacing(null)
            setCustomRowSpacing(null)
        }
    }, [selectedCrop])

    const cellSize = 25 // 25cm per cell, 40px for visibility
    const gridWidth = selectedBed?.width_cells || 4
    const gridHeight = selectedBed?.height_cells || 8

    const getEffectiveSpacing = () => {
        if (customSpacing !== null) return customSpacing
        if (selectedCrop) return selectedCrop.spacing_cm
        return 25
    }

    // Calculate the preview area for a given cell position
    const getPreviewArea = (startX: number, startY: number) => {
        if (!selectedCrop) return null

        const spacingCm = customSpacing ?? selectedCrop.spacing_cm
        const rowSpacingCm = customRowSpacing ?? selectedCrop.row_spacing_cm

        const minWidthCells = Math.max(1, Math.ceil(spacingCm / 25))
        const minHeightCells = Math.max(1, Math.ceil(rowSpacingCm / 25))

        // Ensure we don't exceed grid bounds
        const width = Math.min(minWidthCells, gridWidth - startX)
        const height = Math.min(minHeightCells, gridHeight - startY)

        // Check for collisions
        let hasCollision = false
        let outOfBounds = width < minWidthCells || height < minHeightCells

        for (let x = startX; x < startX + width && !hasCollision; x++) {
            for (let y = startY; y < startY + height && !hasCollision; y++) {
                if (getPlacementAt(x, y)) {
                    hasCollision = true
                }
            }
        }

        return {
            startX,
            startY,
            width,
            height,
            isValid: !hasCollision && !outOfBounds,
            requiredWidth: minWidthCells,
            requiredHeight: minHeightCells
        }
    }

    // Check if a cell is in the preview area
    const isInPreviewArea = (x: number, y: number) => {
        if (!previewCell || !selectedCrop || isDrawing) return null

        const preview = getPreviewArea(previewCell.x, previewCell.y)
        if (!preview) return null

        if (x >= preview.startX && x < preview.startX + preview.width &&
            y >= preview.startY && y < preview.startY + preview.height) {
            return preview.isValid ? 'valid' : 'invalid'
        }
        return null
    }

    const handleMouseDown = (e: React.MouseEvent, x: number, y: number) => {
        if (editMode !== 'crops' || !selectedCrop) return

        // Right click to rotate
        if (e.button === 2) {
            e.preventDefault()
            const currentSpacing = customSpacing ?? selectedCrop.spacing_cm
            const currentRowSpacing = customRowSpacing ?? selectedCrop.row_spacing_cm
            setCustomSpacing(currentRowSpacing)
            setCustomRowSpacing(currentSpacing)
            return
        }

        setIsDrawing(true)
        setDrawStart({ x, y })
        setDrawEnd({ x, y })
    }

    const handleMouseEnter = (x: number, y: number) => {
        if (!isDrawing) return
        setDrawEnd({ x, y })
    }

    const handleMouseUp = async () => {
        if (!isDrawing || !drawStart || !drawEnd || !selectedBed || !selectedCrop) {
            setIsDrawing(false)
            setDrawStart(null)
            setDrawEnd(null)
            return
        }

        // Get effective spacing values
        const spacingCm = customSpacing ?? selectedCrop.spacing_cm
        const rowSpacingCm = customRowSpacing ?? selectedCrop.row_spacing_cm

        // Calculate minimum cells needed based on spacing (each cell is 25cm)
        // We need at least enough space for the spacing requirements
        const minWidthCells = Math.max(1, Math.ceil(spacingCm / 25))
        const minHeightCells = Math.max(1, Math.ceil(rowSpacingCm / 25))

        const drawnMinX = Math.min(drawStart.x, drawEnd.x)
        const drawnMaxX = Math.max(drawStart.x, drawEnd.x)
        const drawnMinY = Math.min(drawStart.y, drawEnd.y)
        const drawnMaxY = Math.max(drawStart.y, drawEnd.y)
        const drawnWidth = drawnMaxX - drawnMinX + 1
        const drawnHeight = drawnMaxY - drawnMinY + 1

        // Use the larger of drawn size or minimum required size
        const width = Math.max(drawnWidth, minWidthCells)
        const height = Math.max(drawnHeight, minHeightCells)

        // Position starts at the drawn minimum, but we need to check bounds
        const minX = drawnMinX
        const minY = drawnMinY

        // Ensure we don't exceed grid bounds
        const finalWidth = Math.min(width, gridWidth - minX)
        const finalHeight = Math.min(height, gridHeight - minY)

        // Check if area goes out of bounds (required size doesn't fit)
        if (finalWidth < minWidthCells || finalHeight < minHeightCells) {
            // Out of bounds - can't place here
            setIsDrawing(false)
            setDrawStart(null)
            setDrawEnd(null)
            return
        }

        // Check for collisions with existing placements in the expanded area
        for (let x = minX; x < minX + finalWidth; x++) {
            for (let y = minY; y < minY + finalHeight; y++) {
                if (getPlacementAt(x, y)) {
                    // Collision detected
                    setIsDrawing(false)
                    setDrawStart(null)
                    setDrawEnd(null)
                    return
                }
            }
        }

        try {
            await createPlacement({
                bed_id: selectedBed.id,
                crop_id: selectedCrop.id,
                position_x: minX,
                position_y: minY,
                width_cells: finalWidth,
                height_cells: finalHeight,
                custom_spacing_cm: customSpacing ?? undefined,
                custom_row_spacing_cm: customRowSpacing ?? undefined,
            })
        } catch (error) {
            console.error('Failed to create placement:', error)
        }

        setIsDrawing(false)
        setDrawStart(null)
        setDrawEnd(null)
    }

    const handleDeletePlacement = async (placementId: string) => {
        try {
            await deletePlacement(placementId)
        } catch (error) {
            console.error('Failed to delete placement:', error)
        }
    }

    const isInDrawArea = (x: number, y: number) => {
        if (!drawStart || !drawEnd || !selectedCrop) return false

        // Get effective spacing values
        const spacingCm = customSpacing ?? selectedCrop.spacing_cm
        const rowSpacingCm = customRowSpacing ?? selectedCrop.row_spacing_cm

        // Calculate minimum cells needed based on spacing
        const minWidthCells = Math.max(1, Math.ceil(spacingCm / 25))
        const minHeightCells = Math.max(1, Math.ceil(rowSpacingCm / 25))

        const drawnMinX = Math.min(drawStart.x, drawEnd.x)
        const drawnMaxX = Math.max(drawStart.x, drawEnd.x)
        const drawnMinY = Math.min(drawStart.y, drawEnd.y)
        const drawnMaxY = Math.max(drawStart.y, drawEnd.y)
        const drawnWidth = drawnMaxX - drawnMinX + 1
        const drawnHeight = drawnMaxY - drawnMinY + 1

        // Use the larger of drawn size or minimum required size
        const width = Math.max(drawnWidth, minWidthCells)
        const height = Math.max(drawnHeight, minHeightCells)

        // Check if cell is within the expanded area
        return x >= drawnMinX && x < drawnMinX + width && y >= drawnMinY && y < drawnMinY + height
    }

    // Memoize placement lookup - rebuilds whenever placements array changes
    const placementMap = useMemo(() => {
        const map = new Map<string, CropPlacement>()
        for (const p of placements) {
            for (let px = p.position_x; px < p.position_x + p.width_cells; px++) {
                for (let py = p.position_y; py < p.position_y + p.height_cells; py++) {
                    map.set(`${px},${py}`, p)
                }
            }
        }
        return map
    }, [placements])

    const getPlacementAt = (x: number, y: number): CropPlacement | null => {
        return placementMap.get(`${x},${y}`) || null
    }

    const calculatePlantCount = (placement: CropPlacement): number => {
        const spacingCm = placement.custom_spacing_cm ?? placement.crop.spacing_cm
        const rowSpacingCm = placement.custom_row_spacing_cm ?? placement.crop.row_spacing_cm
        const widthCm = placement.width_cells * 25
        const heightCm = placement.height_cells * 25

        // Calculate how many plants fit: we get 1 plant, plus 1 more for each additional spacing that fits
        // Example: 100cm width with 100cm spacing = 1 plant (floor(100/100) = 1)
        // Example: 200cm width with 100cm spacing = 2 plants (floor(200/100) = 2)
        const plantsInRow = Math.max(1, Math.floor(widthCm / spacingCm))
        const rows = Math.max(1, Math.floor(heightCm / rowSpacingCm))
        return plantsInRow * rows
    }

    if (isLoading && !currentGarden) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('bed.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{currentGarden?.name}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEditMode('view')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'view'
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                            : 'bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg'
                            }`}
                    >
                        <Eye className="w-4 h-4" />
                        View
                    </button>
                    <button
                        onClick={() => setEditMode('crops')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'crops'
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                            : 'bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg'
                            }`}
                    >
                        <Edit className="w-4 h-4" />
                        Plant Crops
                    </button>
                    <button
                        onClick={() => setEditMode('zones')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${editMode === 'zones'
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                            : 'bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg'
                            }`}
                    >
                        <Edit className="w-4 h-4" />
                        Zone Edit
                    </button>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Bed Selector */}
                <div className="w-64 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Select Bed</h3>

                    {beds.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            No beds available. Create beds in Overview.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {beds.map((bed) => (
                                <button
                                    key={bed.id}
                                    onClick={() => setSelectedBed(bed)}
                                    className={`w-full text-left p-3 rounded-xl transition-colors ${selectedBed?.id === bed.id
                                        ? 'bg-primary-100 dark:bg-dark-selected border-2 border-primary-300 dark:border-primary-600'
                                        : 'bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-dark-selected border-2 border-transparent'
                                        }`}
                                >
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{bed.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {(bed.width_cells * 25) / 100}m × {(bed.height_cells * 25) / 100}m
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bed Grid */}
                <div className="flex-1 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                    {selectedBed ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedBed.name}</h3>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Each cell = 25cm × 25cm
                                </span>
                            </div>

                            <div className="py-4 px-2">
                                <div
                                    ref={gridRef}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="mx-auto border border-gray-200 dark:border-gray-600 rounded-lg select-none"
                                    style={{
                                        width: gridWidth * cellSize,
                                        height: gridHeight * cellSize,
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
                                        gridTemplateRows: `repeat(${gridHeight}, ${cellSize}px)`,
                                        position: 'relative',
                                        overflow: 'visible',
                                    }}
                                    onMouseLeave={() => {
                                        if (isDrawing) {
                                            handleMouseUp()
                                        }
                                    }}
                                >
                                    {Array.from({ length: gridWidth * gridHeight }).map((_, i) => {
                                        const x = i % gridWidth
                                        const y = Math.floor(i / gridWidth)
                                        const placement = getPlacementAt(x, y)
                                        const isDrawSelection = isInDrawArea(x, y) && isDrawing
                                        const isPlacementOrigin = placement && placement.position_x === x && placement.position_y === y
                                        const previewStatus = isInPreviewArea(x, y)

                                        // Determine if this cell is on a 1-meter boundary (every 4 cells = 100cm)
                                        const isRightMeterLine = (x + 1) % 4 === 0
                                        const isBottomMeterLine = (y + 1) % 4 === 0
                                        const isLeftMeterLine = x % 4 === 0
                                        const isTopMeterLine = y % 4 === 0

                                        // Determine background color
                                        let bgColor = undefined
                                        if (placement) {
                                            bgColor = `${getCropColor(placement.crop_id)}30`
                                        } else if (previewStatus === 'valid') {
                                            bgColor = 'rgba(34, 197, 94, 0.3)' // green
                                        } else if (previewStatus === 'invalid') {
                                            bgColor = 'rgba(239, 68, 68, 0.3)' // red
                                        }

                                        return (
                                            <div
                                                key={`${x}-${y}-${placement?.id ?? 'empty'}`}
                                                className={`flex items-center justify-center text-lg transition-colors relative group ${editMode === 'crops' && selectedCrop && !placement
                                                    ? 'cursor-crosshair'
                                                    : placement && editMode === 'crops' ? 'cursor-pointer' : ''
                                                    } ${isDrawSelection && selectedCrop ? 'ring-2 ring-primary-400 ring-inset' : ''}`}
                                                style={{
                                                    backgroundColor: bgColor,
                                                    borderTop: isTopMeterLine ? (isDark ? '1px solid #444' : '1px solid #9ca3af') : (isDark ? '1px solid #333' : '1px solid #e5e7eb'),
                                                    borderLeft: isLeftMeterLine ? (isDark ? '1px solid #444' : '1px solid #9ca3af') : (isDark ? '1px solid #333' : '1px solid #e5e7eb'),
                                                    borderRight: isRightMeterLine ? (isDark ? '1px solid #444' : '1px solid #9ca3af') : (isDark ? '1px solid #333' : '1px solid #e5e7eb'),
                                                    borderBottom: isBottomMeterLine ? (isDark ? '1px solid #444' : '1px solid #9ca3af') : (isDark ? '1px solid #333' : '1px solid #e5e7eb'),
                                                }}
                                                onMouseDown={(e) => {
                                                    if (placement && editMode === 'crops') {
                                                        e.stopPropagation()
                                                        return
                                                    }
                                                    handleMouseDown(e, x, y)
                                                }}
                                                onMouseEnter={() => {
                                                    if (placement) {
                                                        setHoveredPlacement(placement)
                                                        setHoveredCell({ x, y })
                                                    } else if (editMode === 'crops' && selectedCrop && !isDrawing) {
                                                        setPreviewCell({ x, y })
                                                    }
                                                    handleMouseEnter(x, y)
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredPlacement(null)
                                                    setHoveredCell(null)
                                                    if (!isDrawing) {
                                                        setPreviewCell(null)
                                                    }
                                                }}
                                                onMouseUp={handleMouseUp}
                                                onClick={(e) => {
                                                    if (placement && editMode === 'crops' && !isDrawing) {
                                                        e.stopPropagation()
                                                        setSelectedPlacement(placement)
                                                    }
                                                }}
                                            >

                                                {/* Hover tooltip - show only on the exact cell being hovered */}
                                                {placement && hoveredCell?.x === x && hoveredCell?.y === y && (
                                                    <div
                                                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
                                                        style={{ zIndex: 100 }}
                                                    >
                                                        {placement.crop.name} • {calculatePlantCount(placement)} plants
                                                    </div>
                                                )}

                                                {/* Placement border overlay and pixel-precise plant icons on origin cell */}
                                                {isPlacementOrigin && (() => {
                                                    const spacing = placement.custom_spacing_cm ?? placement.crop.spacing_cm
                                                    const rowSpacing = placement.custom_row_spacing_cm ?? placement.crop.row_spacing_cm
                                                    const widthCm = placement.width_cells * 25
                                                    const heightCm = placement.height_cells * 25

                                                    // Calculate number of plants in each dimension
                                                    const plantsX = Math.max(1, Math.floor(widthCm / spacing))
                                                    const plantsY = Math.max(1, Math.floor(heightCm / rowSpacing))

                                                    // Limit rendered icons to max 1 per cell (25cm) to avoid stacking
                                                    const maxIconsX = placement.width_cells
                                                    const maxIconsY = placement.height_cells
                                                    const iconsX = Math.min(plantsX, maxIconsX)
                                                    const iconsY = Math.min(plantsY, maxIconsY)

                                                    // Calculate spacing for rendered icons (distribute evenly across area)
                                                    const iconSpacingX = widthCm / iconsX
                                                    const iconSpacingY = heightCm / iconsY

                                                    // Generate icon positions (capped for rendering, not actual plant count)
                                                    const plants: { x: number; y: number }[] = []

                                                    for (let row = 0; row < iconsY; row++) {
                                                        for (let col = 0; col < iconsX; col++) {
                                                            // Center each icon in its spacing zone
                                                            const xCm = col * iconSpacingX + iconSpacingX / 2
                                                            const yCm = row * iconSpacingY + iconSpacingY / 2

                                                            plants.push({ x: xCm, y: yCm })
                                                        }
                                                    }

                                                    const emoji = getCropEmoji(placement.crop)

                                                    return (
                                                        <div
                                                            className="absolute inset-0 pointer-events-none"
                                                            style={{
                                                                width: placement.width_cells * cellSize,
                                                                height: placement.height_cells * cellSize,
                                                                border: `2px solid ${getCropColor(placement.crop_id)}`,
                                                                borderRadius: '4px',
                                                                zIndex: 10,
                                                            }}
                                                        >
                                                            {/* Render each plant icon at pixel-precise position */}
                                                            {plants.map((pos, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="absolute flex items-center justify-center select-none"
                                                                    style={{
                                                                        left: pos.x,
                                                                        top: pos.y,
                                                                        transform: 'translate(-50%, -50%)',
                                                                        width: 20,
                                                                        height: 20,
                                                                    }}
                                                                >
                                                                    {isBase64Image(emoji) ? (
                                                                        <img src={emoji} alt={placement.crop.name} className="w-5 h-5 object-contain" />
                                                                    ) : (
                                                                        <span className="text-xl leading-none">{emoji}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            {editMode === 'crops' && (
                                <p className="text-center text-sm text-gray-500 mt-4">
                                    {selectedCrop
                                        ? `Click and drag to plant ${selectedCrop.name}`
                                        : 'Select a crop from the library to start planting'}
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
                {editMode === 'crops' && (
                    <div className="w-72 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Crop Library</h3>

                        {/* Spacing Settings */}
                        {selectedCrop && (
                            <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-dark-bg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Plant Spacing</span>
                                </div>

                                {/* In-row spacing */}
                                <div className="mb-2">
                                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">In-row (between plants)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={customSpacing ?? selectedCrop.spacing_cm}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value)
                                                setCustomSpacing(val > 0 ? val : null)
                                            }}
                                            className="w-20 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 text-sm"
                                            min={5}
                                            max={200}
                                        />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">cm</span>
                                    </div>
                                </div>

                                {/* Row spacing */}
                                <div className="mb-2">
                                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Between rows</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={customRowSpacing ?? selectedCrop.row_spacing_cm}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value)
                                                setCustomRowSpacing(val > 0 ? val : null)
                                            }}
                                            className="w-20 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 text-sm"
                                            min={5}
                                            max={200}
                                        />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">cm</span>
                                    </div>
                                </div>

                                {/* Rotate Button */}
                                <button
                                    onClick={() => {
                                        const currentSpacing = customSpacing ?? selectedCrop.spacing_cm
                                        const currentRowSpacing = customRowSpacing ?? selectedCrop.row_spacing_cm
                                        setCustomSpacing(currentRowSpacing)
                                        setCustomRowSpacing(currentSpacing)
                                    }}
                                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-400 bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-600 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-dark-selected px-3 py-1.5 rounded-lg transition-colors mb-2"
                                    title="Swap spacing values"
                                >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>Rotate Spacing</span>
                                </button>

                                {(customSpacing !== null || customRowSpacing !== null) && (
                                    <button
                                        onClick={() => {
                                            setCustomSpacing(null)
                                            setCustomRowSpacing(null)
                                        }}
                                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1"
                                    >
                                        Reset to defaults
                                    </button>
                                )}
                                <p className="text-xs text-gray-400 mt-2">
                                    Default: {selectedCrop.spacing_cm}cm × {selectedCrop.row_spacing_cm}cm
                                </p>
                            </div>
                        )}

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {crops.map((crop) => (
                                <div
                                    key={crop.id}
                                    onClick={() => setSelectedCrop(crop)}
                                    className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedCrop?.id === crop.id
                                        ? 'bg-primary-100 dark:bg-dark-selected border-2 border-primary-300 dark:border-primary-600'
                                        : 'bg-gray-50 dark:bg-dark-bg hover:bg-primary-50 dark:hover:bg-dark-selected border-2 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: getCropColor(crop.id) }}
                                        />
                                        {(() => {
                                            const icon = getCropEmoji(crop)
                                            if (isBase64Image(icon)) {
                                                return <img src={icon} alt="" className="w-6 h-6 object-contain" />
                                            }
                                            return <span className="text-2xl leading-none">{icon}</span>
                                        })()}
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{crop.name}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {crop.spacing_cm}×{crop.row_spacing_cm}cm grid
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Placed Crops Summary */}
                        {placements.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Planted Crops</h4>
                                <div className="space-y-1">
                                    {placements.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">{p.crop.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">{calculatePlantCount(p)} plants</span>
                                                <button
                                                    onClick={() => handleDeletePlacement(p.id)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {editMode === 'zones' && (
                    <div className="w-72 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Zone Editor</h3>
                        <button className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-dark-selected text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-dark-bg transition-colors">
                            <Plus className="w-4 h-4" />
                            New Zone
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                            Zones group cells for sensor and irrigation control.
                        </p>
                    </div>
                )}
            </div>

            {/* Placement Edit Popup */}
            {selectedPlacement && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setSelectedPlacement(null)}
                >
                    <div
                        className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl p-6 w-80 max-w-[90vw]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const widthCm = selectedPlacement.width_cells * 25
                            const heightCm = selectedPlacement.height_cells * 25
                            const spacing = parseInt(editSpacing) || selectedPlacement.crop.spacing_cm
                            const rowSpacing = parseInt(editRowSpacing) || selectedPlacement.crop.row_spacing_cm
                            const totalPlants = Math.max(1, Math.floor(widthCm / spacing)) * Math.max(1, Math.floor(heightCm / rowSpacing))
                            return (
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-3xl">{getCropEmoji(selectedPlacement.crop.name)}</span>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedPlacement.crop.name}</h3>
                                        <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{totalPlants}</span>
                                    </div>
                                </div>
                            )
                        })()}

                        <div className="space-y-4 mb-6">
                            {/* Plant Count Adjustment - Rows and Plants per Row */}
                            <div>
                                {(() => {
                                    const widthCm = selectedPlacement.width_cells * 25
                                    const heightCm = selectedPlacement.height_cells * 25
                                    const spacing = parseInt(editSpacing) || selectedPlacement.crop.spacing_cm
                                    const rowSpacing = parseInt(editRowSpacing) || selectedPlacement.crop.row_spacing_cm
                                    const plantsX = Math.max(1, Math.floor(widthCm / spacing))
                                    const plantsY = Math.max(1, Math.floor(heightCm / rowSpacing))

                                    const adjustPlantsPerRow = (delta: number) => {
                                        const newPlantsX = Math.max(1, plantsX + delta)
                                        const newSpacing = Math.max(1, Math.floor(widthCm / newPlantsX))

                                        setEditSpacing(String(newSpacing))
                                        const newPlacement = {
                                            ...selectedPlacement,
                                            custom_spacing_cm: newSpacing
                                        }
                                        setSelectedPlacement(newPlacement)
                                        updatePlacement(selectedPlacement.id, { custom_spacing_cm: newSpacing })
                                    }

                                    const adjustRows = (delta: number) => {
                                        const newPlantsY = Math.max(1, plantsY + delta)
                                        const newRowSpacing = Math.max(1, Math.floor(heightCm / newPlantsY))

                                        setEditRowSpacing(String(newRowSpacing))
                                        const newPlacement = {
                                            ...selectedPlacement,
                                            custom_row_spacing_cm: newRowSpacing
                                        }
                                        setSelectedPlacement(newPlacement)
                                        updatePlacement(selectedPlacement.id, { custom_row_spacing_cm: newRowSpacing })
                                    }

                                    return (
                                        <div className="space-y-3">

                                            {/* Plants per row control */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Plants per row</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => adjustPlantsPerRow(-1)}
                                                        disabled={plantsX <= 1}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${plantsX <= 1
                                                            ? 'bg-gray-100 dark:bg-dark-bg text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                            : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-dark-selected hover:text-primary-600 dark:hover:text-primary-400'
                                                            }`}
                                                    >
                                                        −
                                                    </button>
                                                    <span className="w-8 text-center font-semibold text-gray-900 dark:text-gray-100">{plantsX}</span>
                                                    <button
                                                        onClick={() => adjustPlantsPerRow(1)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-dark-selected hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Number of rows control */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Number of rows</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => adjustRows(-1)}
                                                        disabled={plantsY <= 1}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${plantsY <= 1
                                                            ? 'bg-gray-100 dark:bg-dark-bg text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                            : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-dark-selected hover:text-primary-600 dark:hover:text-primary-400'
                                                            }`}
                                                    >
                                                        −
                                                    </button>
                                                    <span className="w-8 text-center font-semibold text-gray-900 dark:text-gray-100">{plantsY}</span>
                                                    <button
                                                        onClick={() => adjustRows(1)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-dark-selected hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Plant Spacing</label>
                                <div className="flex items-center gap-2">
                                    {/* In-row spacing */}
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1">In-row</label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={editSpacing}
                                                onChange={(e) => {
                                                    const valStr = e.target.value
                                                    setEditSpacing(valStr)
                                                    const val = parseInt(valStr)
                                                    if (!isNaN(val) && val > 0) {
                                                        const newPlacement = { ...selectedPlacement, custom_spacing_cm: val }
                                                        setSelectedPlacement(newPlacement)
                                                        updatePlacement(selectedPlacement.id, { custom_spacing_cm: val })
                                                    }
                                                }}
                                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                min={1}
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">cm</span>
                                        </div>
                                    </div>

                                    {/* Rotate button */}
                                    {(() => {
                                        // Check if rotation would fit in the area
                                        const widthCm = selectedPlacement.width_cells * 25
                                        const heightCm = selectedPlacement.height_cells * 25
                                        const spacingVal = parseInt(editSpacing)
                                        const rowSpacingVal = parseInt(editRowSpacing)

                                        // After rotation: in-row becomes rowSpacing, between-rows becomes spacing
                                        // Check if at least 1 plant would fit in each dimension
                                        const wouldFitX = !isNaN(rowSpacingVal) && widthCm >= rowSpacingVal
                                        const wouldFitY = !isNaN(spacingVal) && heightCm >= spacingVal
                                        const canRotate = wouldFitX && wouldFitY

                                        return (
                                            <button
                                                onClick={() => {
                                                    const temp = editSpacing
                                                    setEditSpacing(editRowSpacing)
                                                    setEditRowSpacing(temp)

                                                    const spacingVal = parseInt(editRowSpacing)
                                                    const rowSpacingVal = parseInt(editSpacing)

                                                    if (!isNaN(spacingVal) && !isNaN(rowSpacingVal) && spacingVal > 0 && rowSpacingVal > 0) {
                                                        const newPlacement = {
                                                            ...selectedPlacement,
                                                            custom_spacing_cm: spacingVal,
                                                            custom_row_spacing_cm: rowSpacingVal
                                                        }
                                                        setSelectedPlacement(newPlacement)
                                                        updatePlacement(selectedPlacement.id, {
                                                            custom_spacing_cm: spacingVal,
                                                            custom_row_spacing_cm: rowSpacingVal
                                                        })
                                                    }
                                                }}
                                                disabled={!canRotate}
                                                className={`mt-4 p-2 rounded transition-colors ${canRotate
                                                    ? 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-dark-selected cursor-pointer'
                                                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                    }`}
                                                title={canRotate ? "Swap spacing values" : "Cannot rotate - spacing won't fit"}
                                            >
                                                <RotateCw className="w-4 h-4" />
                                            </button>
                                        )
                                    })()}

                                    {/* Between rows spacing */}
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1">Between rows</label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={editRowSpacing}
                                                onChange={(e) => {
                                                    const valStr = e.target.value
                                                    setEditRowSpacing(valStr)
                                                    const val = parseInt(valStr)
                                                    if (!isNaN(val) && val > 0) {
                                                        const newPlacement = { ...selectedPlacement, custom_row_spacing_cm: val }
                                                        setSelectedPlacement(newPlacement)
                                                        updatePlacement(selectedPlacement.id, { custom_row_spacing_cm: val })
                                                    }
                                                }}
                                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                min={1}
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">cm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedPlacement(null)}
                                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-selected transition-colors text-sm font-medium"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    handleDeletePlacement(selectedPlacement.id)
                                    setSelectedPlacement(null)
                                }}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
