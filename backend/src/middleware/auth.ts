import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Role } from "../auth/users";

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; role: Role; name: string };
}

export interface JwtPayload {
  sub: string;
  role: Role;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "8h" });
}

/** FR4 / NFR "Security": application-layer role-based access control via JWT. */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }
  try {
    const token = header.slice("Bearer ".length);
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: `Role '${req.user.role}' may not perform this action (requires one of: ${allowed.join(", ")})` });
      return;
    }
    next();
  };
}
