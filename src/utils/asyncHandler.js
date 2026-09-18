module.exports = function asyncHandler(controlador) {
  return function (req, res, next) {
    Promise.resolve(controlador(req, res, next)).catch(next);
  };
};
