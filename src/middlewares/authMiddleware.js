const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Acceso denegado' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next(); // El token es válido, continúa hacia la siguiente función en la cadena
  } catch (err) {
    console.error('Error al verificar el token:', err); 
    res.status(400).json({ error: 'Token no válido' });
  }
};

module.exports = authMiddleware;
