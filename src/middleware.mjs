export function requireAuth(req, res, next) {
  if (req.session?.user) {
    return next();
  }

  if (req.originalUrl?.startsWith('/api/')) {
    return res.status(401).json({ error: 'Please log in again.' });
  }

  return res.redirect('/');
}
