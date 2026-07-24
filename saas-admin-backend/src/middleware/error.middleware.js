module.exports = (err, req, res, next) => {
  console.error('SERVER ERROR:', err);

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the SaaS Admin server.';

  return res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
