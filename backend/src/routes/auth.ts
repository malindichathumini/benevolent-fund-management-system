import { Router } from "express";
import { z } from "zod";
import { createUser, findUserByUsername, verifyPassword } from "../auth/users";
import { signToken } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** FR4: "secure, role-based login (JWT)". */
router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const user = findUserByUsername(parsed.data.username);
  if (!user || !verifyPassword(user, parsed.data.password)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signToken({ sub: user.id, role: user.role, name: user.displayName });
  res.json({ token, role: user.role, name: user.displayName });
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(32),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(80),
});

/**
 * FR4: "Register ... using a secure, role-based login." Self-service
 * registration is Donor-only, matching the use-case diagram (the
 * "Register / Login (JWT)" bubble sits only under the Donor actor) -
 * Admin and Fund Manager accounts are provisioned by an administrator
 * through the "Manage Users" screen instead, never through this public
 * endpoint.
 */
router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { username, password, displayName } = parsed.data;
  if (findUserByUsername(username)) {
    res.status(409).json({ error: "That username is already taken" });
    return;
  }

  const user = createUser({ username, password, displayName, role: "Donor" });
  const token = signToken({ sub: user.id, role: user.role, name: user.displayName });
  res.status(201).json({ token, role: user.role, name: user.displayName });
});

export default router;
