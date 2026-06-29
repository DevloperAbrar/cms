/**
 * Standardized API response envelope.
 * All controllers use these helpers for consistent shape:
 * { success: boolean, data?: any, message?: string, errors?: any }
 */

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  };
  
  const sendCreated = (res, data = null, message = 'Created successfully') => {
    return sendSuccess(res, data, message, 201);
  };
  
  const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  };
  
  const sendNotFound = (res, message = 'Resource not found') => {
    return sendError(res, message, 404);
  };
  
  const sendUnauthorized = (res, message = 'Unauthorized') => {
    return sendError(res, message, 401);
  };
  
  const sendForbidden = (res, message = 'Forbidden') => {
    return sendError(res, message, 403);
  };
  
  const sendBadRequest = (res, message = 'Bad request', errors = null) => {
    return sendError(res, message, 400, errors);
  };
  
  const sendConflict = (res, message = 'Conflict') => {
    return sendError(res, message, 409);
  };
  
  module.exports = {
    sendSuccess,
    sendCreated,
    sendError,
    sendNotFound,
    sendUnauthorized,
    sendForbidden,
    sendBadRequest,
    sendConflict,
  };