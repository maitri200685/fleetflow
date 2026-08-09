// UUID Regex Validation Pattern
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates whether a given string is a valid UUID v4
 * @param {string} id 
 * @returns {boolean}
 */
const isValidUuid = (id) => {
    if (!id || typeof id !== 'string') return false;
    return UUID_REGEX.test(id);
};

/**
 * Middleware to validate UUID route parameters (e.g. :id)
 */
const validateUuidParam = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!id || !isValidUuid(id)) {
            return res.status(400).json({
                success: false,
                message: `Invalid UUID format for parameter '${paramName}'`
            });
        }
        next();
    };
};

/**
 * Send standard success single resource response
 */
const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Send standard success list response
 */
const sendList = (res, statusCode = 200, data = [], count = null) => {
    return res.status(statusCode).json({
        success: true,
        count: count !== null ? count : data.length,
        data
    });
};

/**
 * Send standard error response
 * Sanitizes 500 error messages and excludes error details in production environment
 */
const sendError = (res, statusCode = 500, message = "Internal Server Error", error = null) => {
    const isProd = process.env.NODE_ENV === 'production';
    const response = {
        success: false,
        message: (statusCode >= 500 && isProd) ? "Internal Server Error" : message
    };
    if (error && !isProd) {
        response.error = typeof error === 'string' ? error : error.message;
    }
    return res.status(statusCode).json(response);
};

module.exports = {
    isValidUuid,
    validateUuidParam,
    sendSuccess,
    sendList,
    sendError
};
