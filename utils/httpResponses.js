// https://restfulapi.net/http-status-codes/
//usaremos esta utilidad para crear errores siguiendo las convenciones de una restful api

module.exports = {
  ok: (res, data) => res.status(200).json(data),
  created: (res, data) => res.status(201).json(data),
  accepted: (res, data) => res.status(202).json(data),
  noContent: (res) => res.status(204).send(),
  badRequest: (res, message = 'Bad Request') => res.status(400).json({ error: 'BAD_REQUEST', message }),
  unauthorized: (res, message = 'Unauthorized') => res.status(401).json({ error: 'UNAUTHORIZED', message }),
  forbidden: (res, message = 'Forbidden') => res.status(403).json({ error: 'FORBIDDEN', message }),
  notFound: (res, message = 'Not Found') => res.status(404).json({ error: 'NOT_FOUND', message }),
  methodNotAllowed: (res, message = 'Method Not Allowed') => res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message }),
  conflict: (res, message = 'Conflict') => res.status(409).json({ error: 'CONFLICT', message }),
  unprocessableEntity: (res, message = 'Unprocessable Entity') => res.status(422).json({ error: 'UNPROCESSABLE_ENTITY', message }),
  tooManyRequests: (res, message = 'Too Many Requests') => res.status(429).json({ error: 'TOO_MANY_REQUESTS', message }),
  internalError: (res, message = 'Internal Server Error') => res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message }),
  serviceUnavailable: (res, message = 'Service Unavailable') => res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message }),
};
