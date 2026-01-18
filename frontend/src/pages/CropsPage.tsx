import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../store/gardenStore'
import { Loader2, Sprout, Calendar } from 'lucide-react'

// Mock crop data for timeline
const mockCrops = [
    { id: '1', name: 'Tomato', bed: 'Bed 1', status: 'growing', plantedDate: '2024-03-15', harvestDate: '2024-07-15' },
    { id: '2', name: 'Lettuce', bed: 'Bed 1', status: 'planted', plantedDate: '2024-04-01', harvestDate: '2024-05-15' },
    { id: '3', name: 'Carrot', bed: 'Bed 2', status: 'planned', plantedDate: '2024-04-15', harvestDate: '2024-08-01' },
    { id: '4', name: 'Pepper', bed: 'Bed 2', status: 'growing', plantedDate: '2024-03-20', harvestDate: '2024-08-15' },
    { id: '5', name: 'Cucumber', bed: 'Bed 3', status: 'harvested', plantedDate: '2024-02-01', harvestDate: '2024-04-15' },
]

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CropsPage() {
    const { t } = useTranslation()
    const { gardenId } = useParams()
    const { currentGarden, fetchGarden, isLoading } = useGardenStore()

    useEffect(() => {
        if (gardenId) {
            fetchGarden(gardenId)
        }
    }, [gardenId, fetchGarden])

    if (isLoading && !currentGarden) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    // Get current month for highlighting
    const currentMonth = new Date().getMonth()

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('crop.title')}</h1>
                    <p className="text-gray-500">{currentGarden?.name} • {mockCrops.length} crops planted</p>
                </div>
            </div>

            {/* Timeline Legend */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500" />
                        <span className="text-gray-600">Planting Window</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-yellow-500" />
                        <span className="text-gray-600">Care Period</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500" />
                        <span className="text-gray-600">Harvest Window</span>
                    </div>
                </div>
            </div>

            {/* Crops Table with Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Month Headers */}
                <div className="flex border-b border-gray-100">
                    <div className="w-64 p-4 bg-gray-50 font-medium text-gray-700 shrink-0">
                        Crop
                    </div>
                    <div className="flex-1 flex">
                        {months.map((month, i) => (
                            <div
                                key={month}
                                className={`flex-1 p-2 text-center text-sm font-medium border-l border-gray-100 ${i === currentMonth ? 'bg-primary-50 text-primary-700' : 'text-gray-500'
                                    }`}
                            >
                                {month}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Crop Rows */}
                {mockCrops.map((crop) => {
                    const plantMonth = new Date(crop.plantedDate).getMonth()
                    const harvestMonth = new Date(crop.harvestDate).getMonth()
                    const growingStart = plantMonth + 1
                    const growingEnd = harvestMonth - 1

                    return (
                        <div key={crop.id} className="flex border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            {/* Crop Info */}
                            <div className="w-64 p-4 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${crop.status === 'harvested' ? 'bg-gray-100' :
                                            crop.status === 'growing' ? 'bg-green-100' :
                                                crop.status === 'planted' ? 'bg-blue-100' :
                                                    'bg-yellow-100'
                                        }`}>
                                        <Sprout className={`w-5 h-5 ${crop.status === 'harvested' ? 'text-gray-500' :
                                                crop.status === 'growing' ? 'text-green-600' :
                                                    crop.status === 'planted' ? 'text-blue-600' :
                                                        'text-yellow-600'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{crop.name}</p>
                                        <p className="text-xs text-gray-500">{crop.bed}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="flex-1 flex items-center relative">
                                {months.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex-1 h-full border-l border-gray-100 ${i === currentMonth ? 'bg-primary-50/50' : ''
                                            }`}
                                    />
                                ))}

                                {/* Planting bar */}
                                <div
                                    className="absolute h-6 rounded-l-full bg-green-500"
                                    style={{
                                        left: `${(plantMonth / 12) * 100}%`,
                                        width: `${(1 / 12) * 100}%`,
                                    }}
                                />

                                {/* Growing bar */}
                                {growingStart <= growingEnd && (
                                    <div
                                        className="absolute h-6 bg-yellow-500"
                                        style={{
                                            left: `${(growingStart / 12) * 100}%`,
                                            width: `${((growingEnd - growingStart + 1) / 12) * 100}%`,
                                        }}
                                    />
                                )}

                                {/* Harvest bar */}
                                <div
                                    className="absolute h-6 rounded-r-full bg-red-500"
                                    style={{
                                        left: `${(harvestMonth / 12) * 100}%`,
                                        width: `${(1 / 12) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                            <Sprout className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-700">
                                {mockCrops.filter(c => c.status === 'growing').length}
                            </p>
                            <p className="text-sm text-green-600">{t('crop.growing')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-700">
                                {mockCrops.filter(c => c.status === 'planted').length}
                            </p>
                            <p className="text-sm text-blue-600">{t('crop.planted')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                            <Sprout className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-700">
                                {mockCrops.filter(c => c.status === 'harvested').length}
                            </p>
                            <p className="text-sm text-red-600">{t('crop.harvest')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
