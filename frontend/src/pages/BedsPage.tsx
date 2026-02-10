import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore, type Bed } from '../store/gardenStore'
import { useCropStore, type Crop, type CropPlacement } from '../store/cropStore'
import { useThemeStore } from '../store/themeStore'
import { useDeviceStore } from '../store/deviceStore'
import { Loader2, Plus, Edit, Eye, Trash2, Settings, RotateCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

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
    const { currentGarden, beds, zones, fetchGarden, fetchBeds, fetchZones, createZone, updateZone, deleteZone, isLoading } = useGardenStore()
    const { crops, placements, fetchCrops, fetchPlacements, createPlacement, deletePlacement, updatePlacement } = useCropStore()
    const { devices, fetchDevices, updateDevice } = useDeviceStore()
    const { isDark } = useThemeStore()
    const [selectedBed, setSelectedBed] = useState<Bed | null>(null)
    const [editMode, setEditMode] = useState<'view' | 'crops' | 'zones'>('view')
    const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null)
    const [selectedPlacement, setSelectedPlacement] = useState<CropPlacement | null>(null)

    // Zone editor state
    const [zoneSelectionMode, setZoneSelectionMode] = useState(false)
    const [currentZone, setCurrentZone] = useState<{ id?: string; name: string; color: string } | null>(null)
    const [selectedPlacements, setSelectedPlacements] = useState<Set<string>>(new Set())

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
    const [zoomLevel, setZoomLevel] = useState(1)
    const gridRef = useRef<HTMLDivElement>(null)
    const gridContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
            fetchBeds(gardenId)
            fetchCrops()
            fetchDevices()
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
            fetchZones(selectedBed.id)
        }
    }, [selectedBed, fetchPlacements, fetchZones])

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

    const handleFitToScreen = () => {
        if (!selectedBed || !gridContainerRef.current) return

        const containerRect = gridContainerRef.current.getBoundingClientRect()

        // Account for padding: gridContainerRef has p-6 (24px each side)
        // Plus the inner overflow div has p-4 (16px each side)
        // Plus the header with zoom controls (approximately 60px height + mb-4 which is 16px)
        const horizontalPadding = 24 + 16 // p-6 + p-4 on each side = 40px per side
        const verticalPadding = 24 + 16 // p-6 top/bottom + p-4 top/bottom
        const headerHeight = 60 + 16 // header + margin-bottom

        const availableWidth = containerRect.width - (horizontalPadding * 2)
        const availableHeight = containerRect.height - (verticalPadding * 2) - headerHeight

        const bedWidthPx = selectedBed.width_cells * 25
        const bedHeightPx = selectedBed.height_cells * 25

        const zoomX = availableWidth / bedWidthPx
        const zoomY = availableHeight / bedHeightPx

        // Calculate the zoom needed to fit
        const fitZoom = Math.min(zoomX, zoomY)

        // Default to 1.0 (100%), but zoom out if the bed is too big (fitZoom < 1.0)
        // User can manually zoom in further if they want
        const newZoom = Math.min(fitZoom, 1.0)

        setZoomLevel(Math.max(0.2, newZoom))
    }

    // Auto-fit when bed or edit mode changes (as layout/available space changes)
    useEffect(() => {
        if (selectedBed) {
            // Small delay to ensure container is rendered with new layout
            setTimeout(handleFitToScreen, 100)
        }
    }, [selectedBed, editMode])

    const baseCellSize = 25
    const cellSize = baseCellSize * zoomLevel // Scaled cell size
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
        <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden">
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

            <div className="flex-1 min-h-0 flex gap-6">
                {/* Bed Selector */}
                <div className="w-64 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0 overflow-y-auto">
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
                <div
                    ref={gridContainerRef}
                    className="flex-1 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-hidden flex flex-col"
                    onWheel={(e) => {
                        if (!selectedBed || !gridContainerRef.current) return

                        // Prevent default page scroll
                        e.preventDefault()

                        const container = gridContainerRef.current
                        const rect = container.getBoundingClientRect()

                        // Mouse position relative to the container
                        const mouseX = e.clientX - rect.left
                        const mouseY = e.clientY - rect.top

                        // Calculate current point under mouse in "unzoomed" 1.0 coordinate space
                        // (scroll position + mouse offset) / current zoom
                        const pointX = (container.scrollLeft + mouseX) / zoomLevel
                        const pointY = (container.scrollTop + mouseY) / zoomLevel

                        // Calculate new zoom
                        const delta = -Math.sign(e.deltaY) * 0.1
                        const newZoom = Math.min(Math.max(0.2, zoomLevel + delta), 3.0)

                        setZoomLevel(newZoom)

                        // Adjust scroll to keep the point under mouse stationary
                        // New scroll = (point * newZoom) - mouse offset
                        // We use requestAnimationFrame or setTimeout to wait for the zoom render to apply the size change
                        // But React state updates might be batched. For immediate feel we can calculate this.
                        // However, setting scrollTop/Left immediately after setZoomLevel might happen before the DOM layout updates.
                        // We'll use a flushSync or just rely on the fact that we can calculate the target scroll and set it.
                        // Actually, updating scroll needs to happen after layout update.

                        requestAnimationFrame(() => {
                            if (gridContainerRef.current) {
                                gridContainerRef.current.scrollLeft = pointX * newZoom - mouseX
                                gridContainerRef.current.scrollTop = pointY * newZoom - mouseY
                            }
                        })
                    }}
                >
                    {selectedBed ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedBed.name}</h3>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        Each cell = 25cm × 25cm
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-bg rounded-lg p-1">
                                    <button
                                        onClick={() => setZoomLevel(z => Math.max(0.2, z - 0.1))}
                                        className="p-1.5 hover:bg-white dark:hover:bg-dark-surface rounded-md text-gray-600 dark:text-gray-300 transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-medium w-12 text-center text-gray-600 dark:text-gray-300">
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.1))}
                                        className="p-1.5 hover:bg-white dark:hover:bg-dark-surface rounded-md text-gray-600 dark:text-gray-300 transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                                    <button
                                        onClick={handleFitToScreen}
                                        className="p-1.5 hover:bg-white dark:hover:bg-dark-surface rounded-md text-gray-600 dark:text-gray-300 transition-colors"
                                        title="Fit to Screen"
                                    >
                                        <Maximize className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto flex p-4 bg-gray-50/50 dark:bg-dark-bg/30 rounded-xl relative">
                                <div
                                    ref={gridRef}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="m-auto border border-gray-200 dark:border-gray-600 rounded-lg select-none"
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
                                            if (zoneSelectionMode && currentZone) {
                                                // In selection mode
                                                if (selectedPlacements.has(placement.id)) {
                                                    // Selected for this zone: show zone color
                                                    bgColor = `${currentZone.color}60` // 60 = ~37% opacity
                                                } else {
                                                    // Not selected: show dimmed original color
                                                    bgColor = `${getCropColor(placement.crop_id)}20`
                                                }
                                            } else if (editMode === 'zones') {
                                                // Zone view mode: show assigned zone color if any
                                                const assignedZone = zones.find(z => z.id === placement.zone_id)
                                                if (assignedZone) {
                                                    bgColor = `${assignedZone.color}40`
                                                } else {
                                                    bgColor = `${getCropColor(placement.crop_id)}30`
                                                }
                                            } else {
                                                // Normal view
                                                bgColor = `${getCropColor(placement.crop_id)}30`
                                            }
                                        } else if (previewStatus === 'valid') {
                                            bgColor = 'rgba(34, 197, 94, 0.3)' // green
                                        } else if (previewStatus === 'invalid') {
                                            bgColor = 'rgba(239, 68, 68, 0.3)' // red
                                        }

                                        // Check neighbors for same placement to remove internal borders
                                        const topNeighbor = y > 0 ? getPlacementAt(x, y - 1) : null
                                        const bottomNeighbor = y < gridHeight - 1 ? getPlacementAt(x, y + 1) : null
                                        const leftNeighbor = x > 0 ? getPlacementAt(x - 1, y) : null
                                        const rightNeighbor = x < gridWidth - 1 ? getPlacementAt(x + 1, y) : null

                                        // Determine borders
                                        // For placements: 
                                        // - Hide internal borders (even meter lines!)
                                        // - Show external borders with CROP color (planting area color)
                                        // For empty cells:
                                        // - Show standard grid lines

                                        const isSameAsTop = placement && topNeighbor && topNeighbor.id === placement.id
                                        const isSameAsBottom = placement && bottomNeighbor && bottomNeighbor.id === placement.id
                                        const isSameAsLeft = placement && leftNeighbor && leftNeighbor.id === placement.id
                                        const isSameAsRight = placement && rightNeighbor && rightNeighbor.id === placement.id

                                        const meterColorDark = '#444'
                                        const meterColorLight = '#9ca3af'
                                        const gridColorDark = '#333'
                                        const gridColorLight = '#e5e7eb'

                                        const placementBorderColor = placement ? getCropColor(placement.crop_id) : null

                                        // Helper to determine border style
                                        const getBorderStyle = (isMeterLine: boolean, isEdge: boolean) => {
                                            if (placement) {
                                                if (isEdge) return `2px solid ${placementBorderColor}` // Bold outer border
                                                return 'none' // Hide internal borders
                                            }
                                            // Empty cell logic
                                            return isMeterLine
                                                ? `1px solid ${isDark ? meterColorDark : meterColorLight}`
                                                : `1px solid ${isDark ? gridColorDark : gridColorLight}`
                                        }

                                        const borderTop = getBorderStyle(isTopMeterLine, !isSameAsTop)
                                        const borderBottom = getBorderStyle(isBottomMeterLine, !isSameAsBottom)
                                        const borderLeft = getBorderStyle(isLeftMeterLine, !isSameAsLeft)
                                        const borderRight = getBorderStyle(isRightMeterLine, !isSameAsRight)

                                        return (
                                            <div
                                                key={`${x}-${y}-${placement?.id ?? 'empty'}`}
                                                className={`flex items-center justify-center text-lg transition-colors relative group ${editMode === 'crops' && selectedCrop && !placement
                                                    ? 'cursor-crosshair'
                                                    : placement && editMode === 'crops' ? 'cursor-pointer' : ''
                                                    } ${isDrawSelection && selectedCrop ? 'ring-2 ring-primary-400 ring-inset' : ''} 
                                                    ${zoneSelectionMode && placement ? 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset' : ''}
                                                    `}
                                                style={{
                                                    backgroundColor: bgColor,
                                                    borderTop: !isSameAsTop ? borderTop : 'none',
                                                    borderLeft: !isSameAsLeft ? borderLeft : 'none',
                                                    borderRight: !isSameAsRight ? borderRight : 'none',
                                                    borderBottom: !isSameAsBottom ? borderBottom : 'none',
                                                }}
                                                onMouseDown={(e) => {
                                                    if (placement && editMode === 'crops') {
                                                        e.stopPropagation()
                                                        return
                                                    }
                                                    if (zoneSelectionMode) return // Handle in onClick
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
                                                    if (zoneSelectionMode && placement) {
                                                        e.stopPropagation()
                                                        setSelectedPlacements(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(placement.id)) {
                                                                next.delete(placement.id)
                                                            } else {
                                                                next.add(placement.id)
                                                            }
                                                            return next
                                                        })
                                                        return
                                                    }

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
                                                    // We use the scaled container dimensions for spacing
                                                    const containerWidth = placement.width_cells * cellSize
                                                    const containerHeight = placement.height_cells * cellSize
                                                    const iconSpacingX = containerWidth / iconsX
                                                    const iconSpacingY = containerHeight / iconsY

                                                    // Generate icon positions
                                                    const plants: { x: number; y: number }[] = []

                                                    for (let row = 0; row < iconsY; row++) {
                                                        for (let col = 0; col < iconsX; col++) {
                                                            // Center each icon in its spacing zone
                                                            const xPos = col * iconSpacingX + iconSpacingX / 2
                                                            const yPos = row * iconSpacingY + iconSpacingY / 2

                                                            plants.push({ x: xPos, y: yPos })
                                                        }
                                                    }

                                                    const emoji = getCropEmoji(placement.crop)

                                                    const cropColor = getCropColor(placement.crop_id)
                                                    const isHovered = hoveredPlacement?.id === placement.id
                                                    const iconSize = Math.max(12, 20 * zoomLevel) // Scale icon, min 12px

                                                    return (
                                                        <div
                                                            className="absolute inset-0 pointer-events-none transition-all"
                                                            style={{
                                                                width: containerWidth, // redundant but safe
                                                                height: containerHeight,
                                                                border: `2px solid ${cropColor}`,
                                                                borderRadius: '4px',
                                                                zIndex: isHovered ? 20 : 10,
                                                                outline: isHovered ? `2px solid ${cropColor}` : 'none',
                                                                outlineOffset: '1px',
                                                                boxShadow: isHovered
                                                                    ? `0 0 0 3px ${cropColor}40, 0 0 16px ${cropColor}60`
                                                                    : 'none',
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
                                                                        width: iconSize,
                                                                        height: iconSize,
                                                                    }}
                                                                >
                                                                    {isBase64Image(emoji) ? (
                                                                        <img src={emoji} alt={placement.crop.name} style={{ width: iconSize, height: iconSize }} className="object-contain" />
                                                                    ) : (
                                                                        <span style={{ fontSize: iconSize, lineHeight: 1 }}>{emoji}</span>
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
                    <div className="w-72 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0 flex flex-col h-full overflow-hidden">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 shrink-0">Crop Library</h3>

                        {/* Spacing Settings */}
                        {selectedCrop && (
                            <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-dark-bg shrink-0">
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

                        <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
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
                                    {[...placements]
                                        .sort((a, b) => a.crop.name.localeCompare(b.crop.name))
                                        .map((p) => (
                                            <div
                                                key={p.id}
                                                className={`flex items-center justify-between text-sm px-2 py-1 rounded-lg cursor-pointer transition-colors ${hoveredPlacement?.id === p.id
                                                    ? 'bg-primary-100 dark:bg-primary-900/30'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                                    }`}
                                                onMouseEnter={() => setHoveredPlacement(p)}
                                                onMouseLeave={() => setHoveredPlacement(null)}
                                                onClick={() => setSelectedPlacement(p)}
                                            >
                                                <span className="text-gray-600 dark:text-gray-400">{p.crop.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-400">{calculatePlantCount(p)} plants</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDeletePlacement(p.id)
                                                        }}
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

                <div className="w-72 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 shrink-0 flex flex-col h-full overflow-hidden">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 shrink-0">Zone Editor</h3>

                    {!zoneSelectionMode ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Zone List Mode */}
                            <button
                                onClick={() => {
                                    setCurrentZone({ name: '', color: '#4CAF50' })
                                    setZoneSelectionMode(true)
                                    setSelectedPlacements(new Set())
                                }}
                                className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-dark-selected text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-dark-bg transition-colors mb-4 shrink-0"
                            >
                                <Plus className="w-4 h-4" />
                                New Zone
                            </button>

                            {zones.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                                    No zones created yet. Click "New Zone" to create one.
                                </p>
                            ) : (
                                <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                                    {zones.map((zone) => {
                                        const zonePlacements = placements.filter(p => p.zone_id === zone.id)
                                        const zoneDevices = devices.filter(d => d.zone_id === zone.id) // Need to import devices from store

                                        return (
                                            <div
                                                key={zone.id}
                                                className="p-3 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-4 h-4 rounded-full"
                                                            style={{ backgroundColor: zone.color }}
                                                        />
                                                        <span className="font-medium text-gray-900 dark:text-gray-100">{zone.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => deleteZone(zone.id)}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {zonePlacements.length} planted area{zonePlacements.length !== 1 ? 's' : ''}
                                                </p>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                    {zoneDevices.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {zoneDevices.map(d => (
                                                                <span key={d.id} className="bg-white dark:bg-dark-surface px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                                                    {d.friendly_name || d.ieee_address}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-gray-400">No devices assigned</span>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setCurrentZone({ id: zone.id, name: zone.name, color: zone.color })
                                                            setZoneSelectionMode(true)
                                                            setSelectedPlacements(new Set(zonePlacements.map(p => p.id)))
                                                        }}
                                                        className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-selected transition-colors"
                                                    >
                                                        Edit Area
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // Open device selection (could be a modal or expanded view)
                                                            // For now, let's toggle a "device edit" mode or expand generic "Edit"
                                                            // Actually, easiest is to handle device assignment in the Zone Edit mode
                                                            setCurrentZone({ id: zone.id, name: zone.name, color: zone.color })
                                                            setZoneSelectionMode(true)
                                                            setSelectedPlacements(new Set(zonePlacements.map(p => p.id)))
                                                            // We'll add device selection to the edit view
                                                        }}
                                                        className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-selected transition-colors"
                                                    >
                                                        Devices
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Selection Mode */}
                            <div className="mb-4 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/30 shrink-0">
                                <p className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-1">
                                    {currentZone?.id ? 'Edit Zone' : 'Create Zone'}
                                </p>
                                <p className="text-xs text-primary-700 dark:text-primary-300">
                                    Select areas on grid. Assign devices below.
                                </p>
                            </div>

                            <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Zone Name</label>
                                    <input
                                        type="text"
                                        value={currentZone?.name || ''}
                                        onChange={(e) => setCurrentZone(prev => prev ? { ...prev, name: e.target.value } : null)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100"
                                        placeholder="e.g., West Section"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Zone Color</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FFC107', '#F44336', '#8BC34A', '#607D8B'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setCurrentZone(prev => prev ? { ...prev, color } : null)}
                                                className={`w-8 h-8 rounded-full transition-transform ${currentZone?.color === color ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-dark-surface scale-110' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Device Assignment Section */}
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Assigned Devices</label>
                                    <div className="bg-gray-50 dark:bg-dark-bg rounded-xl border border-gray-200 dark:border-gray-700 p-2 max-h-40 overflow-y-auto space-y-2">
                                        {devices.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic text-center">No devices found</p>
                                        ) : (
                                            devices
                                                .filter(d => !d.zone_id || d.zone_id === currentZone?.id) // Show unassigned or assigned to this zone
                                                .map(device => {
                                                    const isAssigned = device.zone_id === currentZone?.id
                                                    return (
                                                        <div
                                                            key={device.id}
                                                            onClick={async () => {
                                                                // Toggle assignment immediately logic? 
                                                                // No, we should probably save on "Save"
                                                                // But updating device needs an API call for each device 
                                                                // Or we can track pending device updates in state
                                                                // For now, let's just use local state to track pending changes if possible
                                                                // But updateDevice is async.
                                                                // Let's toggle immediately but visual feedback?
                                                                // Actually, 'devices' comes from store. 
                                                                // If we update store via API it refreshes.
                                                                // But we only have zone ID *after* saving if it's new.
                                                                // So we can only assign devices to *existing* zones easily here.
                                                                // Use pending state for devices?
                                                                // For MVP: Enable device toggling only if currentZone.id exists.
                                                                if (!currentZone?.id) return // Can't assign to unsaved zone yet

                                                                try {
                                                                    const newZoneId = isAssigned ? null : currentZone.id
                                                                    await updateDevice(device.id, { zone_id: newZoneId })
                                                                } catch (e) {
                                                                    console.error("Failed to update device", e)
                                                                }
                                                            }}
                                                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${isAssigned
                                                                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700'
                                                                : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-selected'
                                                                }`}
                                                        >
                                                            <div>
                                                                <p className="font-medium text-gray-900 dark:text-gray-100">{device.friendly_name || device.ieee_address}</p>
                                                                <p className="text-[10px] text-gray-500">{device.vendor} {device.model}</p>
                                                            </div>
                                                            {isAssigned && <div className="w-2 h-2 rounded-full bg-primary-500"></div>}
                                                        </div>
                                                    )
                                                })
                                        )}
                                    </div>
                                    {!currentZone?.id && (
                                        <p className="text-[10px] text-amber-500 mt-1">Save zone first to assign devices.</p>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Selected planted areas:</p>
                                    {selectedPlacements.size === 0 ? (
                                        <p className="text-xs text-gray-400 italic">None selected</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {Array.from(selectedPlacements).map(placementId => {
                                                const placement = placements.find(p => p.id === placementId)
                                                return placement ? (
                                                    <div key={placementId} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCropColor(placement.crop_id) }} />
                                                        {placement.crop.name}
                                                    </div>
                                                ) : null
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                                <button
                                    onClick={() => {
                                        setZoneSelectionMode(false)
                                        setCurrentZone(null)
                                        setSelectedPlacements(new Set())
                                    }}
                                    className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-selected transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!currentZone || !currentZone.name) return

                                        try {
                                            // Create or get zone ID
                                            let zoneId = currentZone.id
                                            if (!zoneId) {
                                                const newZone = await createZone({
                                                    bed_id: selectedBed.id,
                                                    name: currentZone.name,
                                                    color: currentZone.color
                                                })
                                                zoneId = newZone.id
                                            } else {
                                                // Update existing zone
                                                await updateZone(zoneId, {
                                                    name: currentZone.name,
                                                    color: currentZone.color
                                                })
                                            }

                                            // Update all placements' zone assignments   
                                            for (const placement of placements) {
                                                const shouldBeInZone = selectedPlacements.has(placement.id)
                                                const isInZone = placement.zone_id === zoneId

                                                if (shouldBeInZone && !isInZone) {
                                                    // Add to zone
                                                    await updatePlacement(placement.id, { zone_id: zoneId })
                                                } else if (!shouldBeInZone && isInZone) {
                                                    // Remove from zone
                                                    await updatePlacement(placement.id, { zone_id: null })
                                                }
                                            }

                                            // Refresh data
                                            await fetchPlacements(selectedBed.id)
                                            await fetchZones(selectedBed.id)
                                            // Fetch devices strictly speaking not needed unless we did device updates, 
                                            // which we do immediately on click. 
                                            // But maybe we should fetch devices to be safe if other users changed things.
                                            await fetchDevices()

                                            // Exit selection mode
                                            setZoneSelectionMode(false)
                                            setCurrentZone(null)
                                            setSelectedPlacements(new Set())
                                        } catch (error) {
                                            console.error('Failed to save zone:', error)
                                        }
                                    }}
                                    disabled={!currentZone?.name}
                                    className="flex-1 px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>

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
