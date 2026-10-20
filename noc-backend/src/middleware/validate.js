// Valida y REEMPLAZA req[source] con el resultado parseado de zod (coerciones y defaults incluidos).
// Los ZodError los traduce errorHandler a 400. Requiere Express 4 (req.query es asignable).
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      next(err);
    }
  };
