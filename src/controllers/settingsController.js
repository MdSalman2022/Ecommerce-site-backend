const StoreSettings = require('../models/SiteSettings');

/**
 * Store Settings Controller
 * Handles comprehensive store settings management
 */

/**
 * Get all store settings
 * @route GET /api/settings
 * @access Public
 */
const getSettings = async (req, res) => {
    try {
        const settings = await StoreSettings.getSettings();
        
        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
        });
    }
};

/**
 * Get specific section of settings
 * @route GET /api/settings/:section
 * @access Public
 * @param section - layout, store, social, ecommerce, seo, maintenance, notifications
 */
const getSettingsBySection = async (req, res) => {
    try {
        const { section } = req.params;
        const settings = await StoreSettings.getSettings();

        // Handle legacy announcementBar endpoint
        if (section === 'announcementBar') {
            return res.json({
                success: true,
                data: settings.layout?.announcementBar || {
                    enabled: true,
                    text: '🎉 Welcome to BestDeal!',
                    backgroundColor: '',
                    textColor: '',
                },
            });
        }

        if (!settings[section]) {
            return res.status(404).json({
                success: false,
                message: `Section '${section}' not found`,
            });
        }

        res.json({
            success: true,
            data: settings[section],
        });
    } catch (error) {
        console.error('Error fetching settings section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
        });
    }
};

/**
 * Update entire settings or specific section
 * @route PUT /api/settings
 * @route PUT /api/settings/:section
 * @access Admin only
 */
const updateSettings = async (req, res) => {
    try {
        const { section } = req.params;
        const settings = await StoreSettings.getSettings();

        // Handle legacy announcementBar endpoint
        if (section === 'announcementBar') {
            const { value } = req.body;
            settings.layout.announcementBar = {
                ...settings.layout.announcementBar,
                ...value,
            };
            settings.updatedBy = req.user?._id;
            await settings.save();

            return res.json({
                success: true,
                data: settings.layout.announcementBar,
                message: 'Announcement bar updated successfully',
            });
        }

        if (section) {
            // Update specific section
            if (!settings[section]) {
                return res.status(404).json({
                    success: false,
                    message: `Section '${section}' not found`,
                });
            }

            // Merge with existing section data
            settings[section] = {
                ...settings[section].toObject?.() || settings[section],
                ...req.body,
            };
        } else {
            // Update entire settings (merge at top level)
            const allowedSections = ['layout', 'store', 'social', 'ecommerce', 'seo', 'maintenance', 'notifications'];
            
            for (const key of allowedSections) {
                if (req.body[key]) {
                    settings[key] = {
                        ...settings[key].toObject?.() || settings[key],
                        ...req.body[key],
                    };
                }
            }
        }

        settings.updatedBy = req.user?._id;
        await settings.save();

        res.json({
            success: true,
            data: settings,
            message: 'Settings updated successfully',
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
        });
    }
};

/**
 * Reset settings to defaults
 * @route DELETE /api/settings
 * @access Admin only
 */
const resetSettings = async (req, res) => {
    try {
        await StoreSettings.deleteMany({});
        const settings = await StoreSettings.getSettings(); // Creates new with defaults

        res.json({
            success: true,
            data: settings,
            message: 'Settings reset to defaults',
        });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset settings',
        });
    }
};

module.exports = {
    getSettings,
    getSettingsBySection,
    updateSettings,
    resetSettings,
    // Legacy exports for backwards compatibility
    getAllSettings: getSettings,
    getSettingByKey: getSettingsBySection,
    updateSetting: updateSettings,
    deleteSetting: resetSettings,
};
