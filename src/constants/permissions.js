// Permissions Matrix: admin > moderator > user hierarchy

// Permission Definitions
const PERMISSIONS = {
    // Dashboard & Admin Access
    ACCESS_DASHBOARD: 'access:dashboard',
    VIEW_STATISTICS: 'view:statistics',
    MANAGE_SETTINGS: 'manage:settings',
    
    // User & Role Management (Admin only)
    VIEW_ALL_USERS: 'view:all_users',
    MANAGE_USERS: 'manage:users',
    MANAGE_ROLES: 'manage:roles', // Promote/demote moderators
    
    // Product Management
    VIEW_ALL_PRODUCTS: 'view:all_products',
    CREATE_PRODUCT: 'create:product',
    UPDATE_PRODUCT: 'update:product',
    DELETE_PRODUCT: 'delete:product',
    
    // Order Management
    VIEW_ALL_ORDERS: 'view:all_orders',
    MANAGE_ORDERS: 'manage:orders',
    UPDATE_ORDER_STATUS: 'update:order_status',
    
    // Review Moderation
    VIEW_ALL_REVIEWS: 'view:all_reviews',
    MODERATE_REVIEWS: 'moderate:reviews', // Approve/remove reviews
    
    // Promo Code Management
    VIEW_PROMOS: 'view:promos',
    MANAGE_PROMOS: 'manage:promos',
    
    // Shipment Management
    VIEW_SHIPMENTS: 'view:shipments',
    MANAGE_SHIPMENTS: 'manage:shipments',
    
    // Transaction/Payment View
    VIEW_TRANSACTIONS: 'view:transactions',
};

// Role Definitions
const ROLES = {
    admin: [
        // Full access - all permissions
        ...Object.values(PERMISSIONS),
    ],
    
    moderator: [
        // Dashboard access
        PERMISSIONS.ACCESS_DASHBOARD,
        PERMISSIONS.VIEW_STATISTICS,
        
        // Product management (full)
        PERMISSIONS.VIEW_ALL_PRODUCTS,
        PERMISSIONS.CREATE_PRODUCT,
        PERMISSIONS.UPDATE_PRODUCT,
        PERMISSIONS.DELETE_PRODUCT,
        
        // Order management (view + status update)
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.UPDATE_ORDER_STATUS,
        
        // Review moderation
        PERMISSIONS.VIEW_ALL_REVIEWS,
        PERMISSIONS.MODERATE_REVIEWS,
        
        // Promo codes (view only)
        PERMISSIONS.VIEW_PROMOS,
        
        // Shipments (view + manage)
        PERMISSIONS.VIEW_SHIPMENTS,
        PERMISSIONS.MANAGE_SHIPMENTS,
        
        // Transactions (view only)
        PERMISSIONS.VIEW_TRANSACTIONS,
        
        // Users (view only)
        PERMISSIONS.VIEW_ALL_USERS,
    ],
    
    user: [
        // Regular users have no special permissions
        // They can only access their own resources (enforced by ownership checks)
    ],
};

// Role Hierarchy
const ROLE_HIERARCHY = {
    admin: 3,
    moderator: 2,
    user: 1,
};

// Check if a role has a specific permission
const hasPermission = (role, permission) => {
    const rolePermissions = ROLES[role] || [];
    return rolePermissions.includes(permission);
};

// Check if a role has all specified permissions
const hasAllPermissions = (role, permissions) => {
    return permissions.every(perm => hasPermission(role, perm));
};

// Check if a role has any of the specified permissions
const hasAnyPermission = (role, permissions) => {
    return permissions.some(perm => hasPermission(role, perm));
};

// Check if roleA outranks roleB in hierarchy
const outranks = (roleA, roleB) => {
    return (ROLE_HIERARCHY[roleA] || 0) > (ROLE_HIERARCHY[roleB] || 0);
};

// Get all permissions for a role
const getPermissions = (role) => {
    return ROLES[role] || [];
};

module.exports = {
    PERMISSIONS,
    ROLES,
    ROLE_HIERARCHY,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    outranks,
    getPermissions,
};
