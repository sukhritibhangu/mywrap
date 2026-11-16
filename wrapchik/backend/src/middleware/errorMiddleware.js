// Centralized Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  let statusCode = Number(err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode));
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Requested resource not found (Invalid ID)';
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value entered for field: ${field}. Please use another value.`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join(', ');
  }

  if (statusCode >= 500 && !err.expose) {
    message = 'Internal Server Error';
  }

  console.error(`[Error Handler] ${statusCode} - ${statusCode >= 500 && !err.expose ? 'Request failed' : message}`);

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
