export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'البيانات المرسلة غير صالحة',
      errors: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
    });
  }
  req.body = parsed.data;
  next();
};
