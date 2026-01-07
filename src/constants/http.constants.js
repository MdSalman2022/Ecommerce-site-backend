/**
 * HTTP Constants
 * Common HTTP status codes and messages
 */

const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
};

const HTTP_MESSAGES = {
    [HTTP_STATUS.OK]: 'Success',
    [HTTP_STATUS.CREATED]: 'Resource created successfully',
    [HTTP_STATUS.BAD_REQUEST]: 'Bad request',
    [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
    [HTTP_STATUS.FORBIDDEN]: 'Forbidden',
    [HTTP_STATUS.NOT_FOUND]: 'Resource not found',
    [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

module.exports = {
    HTTP_STATUS,
    HTTP_MESSAGES,
};
