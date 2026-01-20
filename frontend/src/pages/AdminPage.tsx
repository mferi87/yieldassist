import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useCropStore, Crop } from '../store/cropStore'
import { useUserStore, User } from '../store/userStore'
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
    Loader2,
    User as UserIcon,
    Sprout,
    Shield
} from 'lucide-react'
import { getCropEmoji, isBase64Image } from '../utils/cropUtils'

type Tab = 'crops' | 'users'

export default function AdminPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { crops, isLoading: cropsLoading, fetchCrops, createCrop, updateCrop, deleteCrop } = useCropStore()
    const { users, isLoading: usersLoading, fetchUsers, updateUserAdminStatus, deleteUser } = useUserStore()

    const [activeTab, setActiveTab] = useState<Tab>('crops')
    const [searchQuery, setSearchQuery] = useState('')

    // Crop Modal State
    const [isCropModalOpen, setIsCropModalOpen] = useState(false)
    const [editingCrop, setEditingCrop] = useState<Crop | null>(null)
    const [cropForm, setCropForm] = useState<Partial<Crop>>({
        name: '',
        spacing_cm: 25,
        row_spacing_cm: 25,
    })

    useEffect(() => {
        if (user && !user.is_global_admin) {
            navigate('/')
            return
        }
        if (activeTab === 'crops') {
            fetchCrops()
        } else {
            fetchUsers()
        }
    }, [user, navigate, activeTab, fetchCrops, fetchUsers])

    const filteredCrops = crops.filter(crop =>
        crop.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleOpenCropModal = (crop?: Crop) => {
        if (crop) {
            setEditingCrop(crop)
            setCropForm(crop)
        } else {
            setEditingCrop(null)
            setCropForm({
                name: '',
                spacing_cm: 25,
                row_spacing_cm: 25,
                is_public: true,
                is_approved: true,
            })
        }
        setIsCropModalOpen(true)
    }

    const handleCropSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingCrop) {
                await updateCrop(editingCrop.id, cropForm)
            } else {
                const newCropData = {
                    name: cropForm.name || 'New Crop',
                    spacing_cm: cropForm.spacing_cm || 25,
                    row_spacing_cm: cropForm.row_spacing_cm || 25,
                    is_public: cropForm.is_public,
                    is_approved: cropForm.is_approved,
                    icon: cropForm.icon
                }
                await createCrop(newCropData)
            }
            setIsCropModalOpen(false)
        } catch (error) {
            console.error('Failed to save crop:', error)
        }
    }

    const handleDeleteCrop = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this crop?')) {
            try {
                await deleteCrop(id)
            } catch (error) {
                console.error('Failed to delete crop:', error)
            }
        }
    }

    const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
        if (userId === user?.id) {
            alert("You cannot change your own admin status.")
            return
        }
        if (window.confirm(`Are you sure you want to ${currentStatus ? 'revoke' : 'grant'} Global Admin access?`)) {
            await updateUserAdminStatus(userId, !currentStatus)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (userId === user?.id) {
            alert("You cannot delete your own account.")
            return
        }
        if (window.confirm('Are you sure you want to delete this user? This cannot be undone.')) {
            await deleteUser(userId)
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-500 mt-1">Manage global settings, crops, and users</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('crops')}
                        className={`
                            group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                            ${activeTab === 'crops'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <Sprout className={`
                            -ml-0.5 mr-2 h-5 w-5
                            ${activeTab === 'crops' ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}
                        `} />
                        All Crops
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`
                            group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                            ${activeTab === 'users'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <UserIcon className={`
                            -ml-0.5 mr-2 h-5 w-5
                            ${activeTab === 'users' ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}
                        `} />
                        Users & Roles
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={activeTab === 'crops' ? "Search crops..." : "Search users..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                        />
                    </div>
                    {activeTab === 'crops' && (
                        <button
                            onClick={() => handleOpenCropModal()}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-5 h-5" />
                            Add Crop
                        </button>
                    )}
                </div>

                {/* Loading State */}
                {(activeTab === 'crops' ? cropsLoading : usersLoading) ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {activeTab === 'crops' ? (
                            /* CROPS TABLE */
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                                        <th className="py-3 px-4 font-semibold">Icon</th>
                                        <th className="py-3 px-4 font-semibold">Name</th>
                                        <th className="py-3 px-4 font-semibold">In-row Spacing</th>
                                        <th className="py-3 px-4 font-semibold">Row Spacing</th>
                                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCrops.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500">
                                                No crops found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCrops.map((crop) => (
                                            <tr key={crop.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                                                        {crop.icon?.startsWith('data:') || crop.icon?.startsWith('http') ? (
                                                            <img src={crop.icon} alt={crop.name} className="w-8 h-8 object-contain rounded" />
                                                        ) : (
                                                            <span className="text-2xl leading-none">{getCropEmoji(crop)}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-gray-900">
                                                    {crop.name}
                                                    {crop.is_public && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            Public
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{crop.spacing_cm} cm</td>
                                                <td className="py-3 px-4 text-gray-600">{crop.row_spacing_cm} cm</td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenCropModal(crop)}
                                                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCrop(crop.id)}
                                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            /* USERS TABLE */
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                                        <th className="py-3 px-6 font-semibold">User</th>
                                        <th className="py-3 px-6 font-semibold">Email</th>
                                        <th className="py-3 px-6 font-semibold">Role</th>
                                        <th className="py-3 px-6 font-semibold">Joined At</th>
                                        <th className="py-3 px-6 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500">
                                                No users found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-u-50 transition-colors">
                                                <td className="py-4 px-6 font-medium text-gray-900">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-gray-600">{u.email}</td>
                                                <td className="py-4 px-6">
                                                    {u.is_global_admin ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                            <Shield className="w-3 h-3" />
                                                            Global Admin
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            User
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-gray-500 text-sm">
                                                    {new Date(u.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleToggleAdmin(u.id, u.is_global_admin)}
                                                            className={`
                                                                text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors
                                                                ${u.is_global_admin
                                                                    ? 'border-red-200 text-red-700 hover:bg-red-50'
                                                                    : 'border-primary-200 text-primary-700 hover:bg-primary-50'}
                                                            `}
                                                            disabled={u.id === user?.id}
                                                        >
                                                            {u.is_global_admin ? 'Revoke Admin' : 'Make Admin'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete User"
                                                            disabled={u.id === user?.id}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Crop Modal */}
            {isCropModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingCrop ? 'Edit Crop' : 'Add New Crop'}
                            </h2>
                            <button
                                onClick={() => setIsCropModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCropSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Icon
                                    </label>
                                    <div className="flex gap-2 items-center h-[42px]">
                                        {(cropForm.icon?.startsWith('http') || cropForm.icon?.startsWith('data:')) ? (
                                            <div className="w-[42px] h-[42px] border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                                                <img
                                                    src={cropForm.icon}
                                                    alt="Icon"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={cropForm.icon || ''}
                                                    onChange={(e) => setCropForm({ ...cropForm, icon: e.target.value })}
                                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                    placeholder="🍅 or URL"
                                                />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">
                                                    {cropForm.icon ? cropForm.icon : '🌱'}
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
                                                            setCropForm({ ...cropForm, icon: reader.result as string })
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
                                        value={cropForm.icon?.startsWith('http') || cropForm.icon?.startsWith('data:') ? cropForm.name : cropForm.name}
                                        onChange={(e) => setCropForm({ ...cropForm, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        In-row Spacing (cm)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={cropForm.spacing_cm}
                                        onChange={(e) => setCropForm({ ...cropForm, spacing_cm: parseInt(e.target.value) })}
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
                                        value={cropForm.row_spacing_cm}
                                        onChange={(e) => setCropForm({ ...cropForm, row_spacing_cm: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>


                            {/* Timeline Section */}
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <span className="text-lg">📅</span> Growing Timeline
                                </h3>

                                <div className="grid grid-cols-3 gap-4">
                                    {/* Planting Window */}
                                    <div className="bg-green-50 rounded-lg p-3">
                                        <label className="block text-xs font-medium text-green-700 mb-2">
                                            🌱 Planting Window
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={cropForm.plant_month_start ?? 3}
                                                onChange={(e) => setCropForm({ ...cropForm, plant_month_start: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-gray-400 self-center">→</span>
                                            <select
                                                value={cropForm.plant_month_end ?? 4}
                                                onChange={(e) => setCropForm({ ...cropForm, plant_month_end: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Care Period */}
                                    <div className="bg-yellow-50 rounded-lg p-3">
                                        <label className="block text-xs font-medium text-yellow-700 mb-2">
                                            🌿 Care Period
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={cropForm.care_month_start ?? 4}
                                                onChange={(e) => setCropForm({ ...cropForm, care_month_start: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-yellow-200 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-gray-400 self-center">→</span>
                                            <select
                                                value={cropForm.care_month_end ?? 7}
                                                onChange={(e) => setCropForm({ ...cropForm, care_month_end: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-yellow-200 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Harvest Window */}
                                    <div className="bg-red-50 rounded-lg p-3">
                                        <label className="block text-xs font-medium text-red-700 mb-2">
                                            🍅 Harvest Window
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={cropForm.harvest_month_start ?? 7}
                                                onChange={(e) => setCropForm({ ...cropForm, harvest_month_start: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-red-200 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-gray-400 self-center">→</span>
                                            <select
                                                value={cropForm.harvest_month_end ?? 9}
                                                onChange={(e) => setCropForm({ ...cropForm, harvest_month_end: parseInt(e.target.value) })}
                                                className="flex-1 text-xs px-2 py-1.5 border border-red-200 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                                    <option key={i} value={i}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={cropForm.is_public || false}
                                            onChange={(e) => setCropForm({ ...cropForm, is_public: e.target.checked })}
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
                                        onClick={() => setIsCropModalOpen(false)}
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
            )}
        </div >
    )
}
