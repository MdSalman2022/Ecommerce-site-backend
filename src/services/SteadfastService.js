const { STEADFAST_API_KEY, STEADFAST_SECRET_KEY, STEADFAST_BASE_URL } = process.env;

/**
 * Steadfast Courier Service
 * Wraps the Steadfast API for order creation and status checking.
 * Base URL: https://portal.packzy.com/api/v1 (default)
 */
class SteadfastService {
    constructor() {
        this.baseUrl = STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
        this.headers = {
            'Api-Key': STEADFAST_API_KEY,
            'Secret-Key': STEADFAST_SECRET_KEY,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create a new order in Steadfast system
     * @param {Object} orderData
     * @returns {Promise<Object>}
     */
    async createOrder(orderData) {
        try {
            const response = await fetch(`${this.baseUrl}/create_order`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(orderData),
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Steadfast Create Order Error:', error);
            throw new Error('Failed to create order with Steadfast');
        }
    }

    /**
     * Check delivery status by Consignment ID
     * @param {String} consignmentId
     * @returns {Promise<Object>}
     */
    async checkStatus(consignmentId) {
        try {
            const response = await fetch(`${this.baseUrl}/status_by_cid/${consignmentId}`, {
                method: 'GET',
                headers: this.headers,
            });
            return await response.json();
        } catch (error) {
            console.error('Steadfast Status Check Error:', error);
            return null;
        }
    }

    /**
     * Get Current Balance
     * @returns {Promise<Object>}
     */
    async getBalance() {
        try {
            const response = await fetch(`${this.baseUrl}/get_balance`, {
                method: 'GET',
                headers: this.headers,
            });
            return await response.json();
        } catch (error) {
            console.error('Steadfast Balance Error:', error);
            return null;
        }
    }
}

module.exports = new SteadfastService();
