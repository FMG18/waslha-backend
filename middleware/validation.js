function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema(req.body, req.params, req.query);
      if (result && result.error) {
        const error = new Error(result.error);
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }
      next();
    } catch (error) { next(error); }
  };
}

const isFiniteNumber = value => value !== '' && Number.isFinite(Number(value));
const coordinates = value => Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber) && Number(value[0]) >= -180 && Number(value[0]) <= 180 && Number(value[1]) >= -90 && Number(value[1]) <= 90;

module.exports = { validate, isFiniteNumber, coordinates };
