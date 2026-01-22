import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../store/gardenStore'
import { useCropStore, type CropPlacement } from '../store/cropStore'
import { Loader2, Sprout, Calendar } from 'lucide-react'

// Crop emoji mapping
const CROP_EMOJIS: Record<string, string> = {
    'Tomato': '🍅',
    'Lettuce': '🥬',
    'Carrot': '🥕',
    'Bell Pepper': '🫑',
    'Pepper': '🫑',
    'Cucumber': '🥒',
    'Zucchini': '🥒',
    'Green Bean': '🫛',
    'Onion': '🧅',
    'Garlic': '🧄',
    'Potato': '🥔',
    'Radish': '🌰',
    'Spinach': '🥬',
    'Broccoli': '🥦',
    'Cabbage': '🥬',
    'Pumpkin': '🎃',
}

const getCropEmoji = (cropName: string): string => {
    return CROP_EMOJIS[cropName] || '🌱'
}

// Calculate plant count from placement
const calculatePlantCount = (placement: CropPlacement): number => {
    const spacingCm = placement.custom_spacing_cm || placement.crop.spacing_cm || 25
    const rowSpacingCm = placement.custom_row_spacing_cm || placement.crop.row_spacing_cm || 25
    const widthCm = placement.width_cells * 25
    const heightCm = placement.height_cells * 25
    const plantsPerRow = Math.floor(widthCm / spacingCm) || 1
    const numRows = Math.floor(heightCm / rowSpacingCm) || 1
    return plantsPerRow * numRows
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Get timeline months based on status (simplified - assumes current year growing season)
const getTimelineMonths = (status: string) => {
    // Simplified timeline based on status
    switch (status) {
        case 'planted':
            return { plantMonth: new Date().getMonth(), harvestMonth: new Date().getMonth() + 3 }
        case 'growing':
            return { plantMonth: new Date().getMonth() - 1, harvestMonth: new Date().getMonth() + 2 }
        case 'harvested':
            return { plantMonth: new Date().getMonth() - 3, harvestMonth: new Date().getMonth() }
        case 'planned':
        default:
            return { plantMonth: new Date().getMonth() + 1, harvestMonth: new Date().getMonth() + 4 }
    }
}

export default function CropsPage() {
    const { t } = useTranslation()
    const { gardenId } = useParams()
    const navigate = useNavigate()
    const { currentGarden, beds, fetchGarden, fetchBeds, isLoading: gardenLoading } = useGardenStore()
    const { gardenPlacements, fetchGardenPlacements, isLoading: cropsLoading } = useCropStore()

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
            fetchBeds(gardenId)
            fetchGardenPlacements(gardenId)
        }
    }, [gardenId, fetchGarden, fetchBeds, fetchGardenPlacements])

    // Group placements by crop
    const placementsByCrop = useMemo(() => {
        const grouped: Record<string, { cropName: string, placements: CropPlacement[], totalPlants: number }> = {}
        for (const placement of gardenPlacements) {
            const cropId = placement.crop_id
            if (!grouped[cropId]) {
                grouped[cropId] = {
                    cropName: placement.crop.name,
                    placements: [],
                    totalPlants: 0
                }
            }
            grouped[cropId].placements.push(placement)
            grouped[cropId].totalPlants += calculatePlantCount(placement)
        }
        return Object.values(grouped)
    }, [gardenPlacements])

    const isLoading = gardenLoading || cropsLoading
    const currentMonth = new Date().getMonth()

    const getBedName = (bedId: string) => {
        const bed = beds.find(b => b.id === bedId)
        return bed?.name || 'Unknown Bed'
    }

    if (isLoading && !currentGarden) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    // Count by status
    const statusCounts = gardenPlacements.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('crop.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{currentGarden?.name} • {placementsByCrop.length} crops planted</p>
                </div>
            </div>

            {/* Empty State */}
            {gardenPlacements.length === 0 && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Sprout className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No crops planted yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Go to the Beds view to place crops in your garden beds.
                    </p>
                    <button
                        onClick={() => navigate(`/garden/${gardenId}/beds`)}
                        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        Go to Beds
                    </button>
                </div>
            )}

            {gardenPlacements.length > 0 && (
                <>
                    {/* Timeline Legend */}
                    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 mb-6">
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-green-500" />
                                <span className="text-gray-600 dark:text-gray-400">Planting Window</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-yellow-500" />
                                <span className="text-gray-600 dark:text-gray-400">Care Period</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-red-500" />
                                <span className="text-gray-600 dark:text-gray-400">Harvest Window</span>
                            </div>
                        </div>
                    </div>

                    {/* Crops Table with Timeline */}
                    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        {/* Month Headers */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700">
                            <div className="w-64 p-4 bg-gray-50 dark:bg-dark-bg font-medium text-gray-700 dark:text-gray-300 shrink-0">
                                Crop
                            </div>
                            <div className="flex-1 flex">
                                {months.map((month, i) => (
                                    <div
                                        key={month}
                                        className={`flex-1 p-2 text-center text-sm font-medium border-l border-gray-100 dark:border-gray-700 ${i === currentMonth ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                    >
                                        {month}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Crop Rows */}
                        {placementsByCrop.map((cropGroup) => {
                            // Use crop's timeline fields
                            const crop = cropGroup.placements[0].crop
                            const plantStart = crop.plant_month_start ?? 3
                            const plantEnd = crop.plant_month_end ?? 4
                            const careStart = crop.care_month_start ?? 4
                            const careEnd = crop.care_month_end ?? 7
                            const harvestStart = crop.harvest_month_start ?? 7
                            const harvestEnd = crop.harvest_month_end ?? 9

                            return (
                                <div key={cropGroup.cropName} className="flex border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                                    {/* Crop Info */}
                                    <div className="w-64 p-4 shrink-0">
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl mt-0.5">
                                                {getCropEmoji(cropGroup.cropName)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-gray-100">{cropGroup.cropName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {cropGroup.totalPlants} plants total
                                                </p>
                                                {/* Beds list */}
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(new Set(cropGroup.placements.map(p => p.bed_id))).map((bedId) => (
                                                        <span
                                                            key={bedId}
                                                            onClick={() => navigate(`/garden/${gardenId}/beds?bed=${bedId}`)}
                                                            className="text-xs bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
                                                        >
                                                            {getBedName(bedId)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline */}
                                    <div className="flex-1 flex items-center relative">
                                        {months.map((_, i) => (
                                            <div
                                                key={i}
                                                className={`flex-1 h-full border-l border-gray-100 dark:border-gray-700 ${i === currentMonth ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''
                                                    }`}
                                            />
                                        ))}

                                        {/* Planting bar */}
                                        <div
                                            className="absolute h-6 rounded-l-full bg-green-500"
                                            style={{
                                                left: `${(plantStart / 12) * 100}%`,
                                                width: `${((plantEnd - plantStart + 1) / 12) * 100}%`,
                                            }}
                                        />

                                        {/* Care/Growing bar */}
                                        {careStart <= careEnd && (
                                            <div
                                                className="absolute h-6 bg-yellow-500"
                                                style={{
                                                    left: `${(careStart / 12) * 100}%`,
                                                    width: `${((careEnd - careStart + 1) / 12) * 100}%`,
                                                }}
                                            />
                                        )}

                                        {/* Harvest bar */}
                                        <div
                                            className="absolute h-6 rounded-r-full bg-red-500"
                                            style={{
                                                left: `${(harvestStart / 12) * 100}%`,
                                                width: `${((harvestEnd - harvestStart + 1) / 12) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                                    <Sprout className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        {statusCounts['growing'] || 0}
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-500">{t('crop.growing')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                        {(statusCounts['planted'] || 0) + (statusCounts['planned'] || 0)}
                                    </p>
                                    <p className="text-sm text-blue-600 dark:text-blue-500">{t('crop.planted')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                                    <Sprout className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                                        {statusCounts['harvested'] || 0}
                                    </p>
                                    <p className="text-sm text-red-600 dark:text-red-500">{t('crop.harvest')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
