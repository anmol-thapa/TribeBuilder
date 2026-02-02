import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Extend the Request interface to include a 'user' property
export interface AuthRequest extends Request {
  user?: any;
}

// Admin Supabase client (used only for verifying access tokens)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  // Try legacy JWT first (issued by our API)
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = user;
    next();
    return;
  } catch {
    // Fallback to Supabase access token validation
  }

  if (!supabaseAdmin) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    // Normalize shape to what the routes expect
    req.user = {
      userId: data.user.id,
      email: data.user.email,
      supabase: true,
    };
    next();
  } catch (err) {
    console.error('Supabase token verification failed', err);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export default authenticateToken;
