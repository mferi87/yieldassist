
// Crop emoji mapping (fallback)
export const CROP_EMOJIS: Record<string, string> = {
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

interface CropLike {
    name: string
    icon?: string
}

export const getCropEmoji = (crop: CropLike | string): string => {
    if (typeof crop === 'string') {
        return CROP_EMOJIS[crop] || '🌱'
    }

    if (crop.icon && crop.icon.trim() !== '') {
        return crop.icon
    }

    return CROP_EMOJIS[crop.name] || '🌱'
}

export const isBase64Image = (str: string): boolean => {
    return str.startsWith('data:image') || str.startsWith('http')
}
