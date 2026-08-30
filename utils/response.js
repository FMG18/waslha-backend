function success(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function failure(res, code, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

module.exports = { success, failure };
