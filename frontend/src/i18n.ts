import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            // Navigation
            'nav.overview': 'Overview',
            'nav.beds': 'Beds',
            'nav.crops': 'Crops',

            // Common
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.edit': 'Edit',
            'common.delete': 'Delete',
            'common.create': 'Create',
            'common.loading': 'Loading...',

            // Auth
            'auth.login': 'Login',
            'auth.register': 'Register',
            'auth.logout': 'Logout',
            'auth.email': 'Email',
            'auth.password': 'Password',
            'auth.name': 'Name',

            // Gardens
            'garden.title': 'My Gardens',
            'garden.create': 'Create Garden',
            'garden.name': 'Garden Name',
            'garden.width': 'Width (m)',
            'garden.height': 'Height (m)',
            'garden.empty': 'No gardens yet. Create your first garden!',

            // Beds
            'bed.title': 'Beds',
            'bed.create': 'Create Bed',
            'bed.name': 'Bed Name',
            'bed.width': 'Width (25cm cells)',
            'bed.height': 'Height (25cm cells)',

            // Crops
            'crop.title': 'Crops',
            'crop.timeline': 'Timeline',
            'crop.planted': 'Planted',
            'crop.growing': 'Growing',
            'crop.harvest': 'Ready to Harvest',

            // Overview
            'overview.editMode': 'Edit Mode',
            'overview.viewMode': 'View Mode',
            'overview.dragBeds': 'Drag beds from the panel to place them',
        },
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
