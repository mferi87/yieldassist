import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useCropStore, Crop } from '../store/cropStore'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Save,
    X,
    MoreVertical,
    CheckCircle,
    XCircle,
    Globe,
    Upload,
    Loader2
} from 'lucide-react'
import { getCropEmoji, isBase64Image } from '../utils/cropUtils'

export default function AdminPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { crops, isLoading, fetchCrops, createCrop, updateCrop, deleteCrop } = useCropStore()

    const [searchQuery, setSearchQuery] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCrop, setEditingCrop] = useState<Crop | null>(null)
    const [formData, setFormData] = useState<Partial<Crop>>({
        name: '',
        per_cell: 1,
        spacing_cm: 25,
        row_spacing_cm: 25,
        cells_width: 1,
        cells_height: 1,
    })

    useEffect(() => {
        if (user && !user.is_global_admin) {
            navigate('/')
            return
        }
        fetchCrops()
    }, [user, navigate, fetchCrops])

    const filteredCrops = crops.filter(crop =>
        crop.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleOpenModal = (crop?: Crop) => {
        if (crop) {
            setEditingCrop(crop)
            setFormData(crop)
        } else {
            setEditingCrop(null)
            setFormData({
                name: '', // Required
                per_cell: 1,
                spacing_cm: 25,
                row_spacing_cm: 25,
                cells_width: 1,
                cells_height: 1,
                is_public: true,
                is_approved: true,
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingCrop) {
                await updateCrop(editingCrop.id, formData)
            } else {
                // Ensure required fields are present for creation
                const newCropData = {
                    name: formData.name || 'New Crop',
                    per_cell: formData.per_cell || 1,
                    spacing_cm: formData.spacing_cm || 25,
                    row_spacing_cm: formData.row_spacing_cm || 25,
                    cells_width: formData.cells_width || 1,
                    cells_height: formData.cells_height || 1,
                    // Additional fields if needed by backend model
                }
                await createCrop(newCropData)
            }
            setIsModalOpen(false)
        } catch (error) {
            console.error('Failed to save crop:', error)
        }
    }

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this crop?')) {
            try {
                await deleteCrop(id)
            } catch (error) {
                console.error('Failed to delete crop:', error)
            }
        }
    }

    if (isLoading && crops.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Crop Management</h1>
                    <p className="text-gray-500">Manage global plant library</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Crop
                </button>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search crops..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            {/* Crops Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Icon</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Crop</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dimensions (Cells)</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Spacing (cm)</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plants/Cell</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredCrops.map((crop) => (
                            <tr key={crop.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg text-xl">
                                        {(() => {
                                            const emoji = getCropEmoji(crop)
                                            if (isBase64Image(emoji)) {
                                                return <img src={emoji} alt={crop.name} className="w-8 h-8 object-contain" />
                                            }
                                            return <span>{emoji}</span>
                                        })()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900">{crop.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {crop.cells_width} × {crop.cells_height}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {crop.spacing_cm} × {crop.row_spacing_cm}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {crop.per_cell}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {crop.is_public ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                <CheckCircle className="w-3 h-3" /> Public
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                Private
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleOpenModal(crop)}
                                        className="text-primary-600 hover:text-primary-900 mr-4"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(crop.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingCrop ? 'Edit Crop' : 'Add New Crop'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Icon
                                    </label>
                                    <div className="flex gap-2 items-center h-[42px]">
                                        {(formData.icon?.startsWith('http') || formData.icon?.startsWith('data:')) ? (
                                            <div className="w-[42px] h-[42px] border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                                                <img
                                                    src={formData.icon}
                                                    alt="Icon"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={formData.icon || ''}
                                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                    placeholder="🍅 or URL"
                                                />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">
                                                    {formData.icon ? formData.icon : '🌱'}
                                                </div>
                                            </div>
                                        )}

                                        <label className="flex items-center justify-center w-[42px] h-[42px] bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors shrink-0" title="Upload Image">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onloadend = () => {
                                                            setFormData({ ...formData, icon: reader.result as string })
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                            <Upload className="w-4 h-4 text-gray-600" />
                                        </label>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Crop Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.icon?.startsWith('http') || formData.icon?.startsWith('data:') ? formData.name : formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Width (Cells)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.cells_width}
                                        onChange={(e) => setFormData({ ...formData, cells_width: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Height (Cells)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.cells_height}
                                        onChange={(e) => setFormData({ ...formData, cells_height: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Spacing (cm)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.spacing_cm}
                                        onChange={(e) => setFormData({ ...formData, spacing_cm: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Row Spacing (cm)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.row_spacing_cm}
                                        onChange={(e) => setFormData({ ...formData, row_spacing_cm: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Plants Per Cell
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.per_cell}
                                    onChange={(e) => setFormData({ ...formData, per_cell: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_public || false}
                                            onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                        <Globe className="w-4 h-4" />
                                        <span>Public</span>
                                    </div>
                                </label>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save Crop
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    )
}
