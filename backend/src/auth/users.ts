import bcrypt from "bcryptjs";
import crypto from "crypto";

export type Role = "Admin" | "FundManager" | "Donor";

export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  displayName: string;
}

export type PublicUser = Omit<AppUser, "passwordHash">;

// --------------------------------------------------------------------
// DEMO user store (Section 4.9: "Phases 2 to 4 ... are planned as the
// next sprints"). This is intentionally a seeded in-memory list, not a
// real user database, so the role-based login flow (FR4) can be
// demonstrated and tested end-to-end before the real persistence layer
// (e.g. PostgreSQL) is wired up. Swap this module for one backed by a
// real database without touching anything else - every other file only
// imports from here, never reaches into USERS directly.
//
// The array is mutable (not `const` arr contents-frozen) so that donor
// self-registration (POST /auth/register, FR4) and the Admin "Manage
// Users" screen (GET/POST/DELETE /users) can add and remove accounts at
// runtime. Like the rest of this demo store, it resets to the three
// seeded accounts below every time the backend restarts.
// --------------------------------------------------------------------

function hash(password: string): string {
  return bcrypt.hashSync(password, 10);
}

const USERS: AppUser[] = [
  { id: "u-admin-1", username: "admin", passwordHash: hash("Admin@123"), role: "Admin", displayName: "Fund Administrator" },
  { id: "u-fm-1", username: "fundmanager", passwordHash: hash("FundMgr@123"), role: "FundManager", displayName: "Fund Manager" },
  { id: "u-donor-1", username: "donor1", passwordHash: hash("Donor@123"), role: "Donor", displayName: "Jeevin (Donor)" },
];

function toPublic({ passwordHash, ...rest }: AppUser): PublicUser {
  return rest;
}

export function findUserByUsername(username: string): AppUser | undefined {
  return USERS.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function findUserById(id: string): AppUser | undefined {
  return USERS.find((u) => u.id === id);
}

export function verifyPassword(user: AppUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

/** Every account, minus password hashes - backs the Admin "Manage Users" screen. */
export function listUsers(): PublicUser[] {
  return USERS.map(toPublic);
}

/**
 * Creates and stores a new account. Used by both donor self-registration
 * (public, Donor role only - see routes/auth.ts) and the Admin "Manage
 * Users" screen (any role, Admin-only route) - which one is allowed to
 * pick the role is enforced by those two call sites, not here.
 */
export function createUser(params: { username: string; password: string; displayName: string; role: Role }): PublicUser {
  const user: AppUser = {
    id: `u-${params.role.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`,
    username: params.username,
    passwordHash: hash(params.password),
    role: params.role,
    displayName: params.displayName,
  };
  USERS.push(user);
  return toPublic(user);
}

/** Removes an account (Admin "Manage Users" screen). Returns false if no such id exists. */
export function deleteUser(id: string): boolean {
  const idx = USERS.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  USERS.splice(idx, 1);
  return true;
}

// Maps each application role onto the Fabric CA identity enrolled for
// that role by fabric-network/03_enroll_users.sh. See that script's
// header comment for why this is one Fabric identity per role rather
// than one per individual user.
export const ROLE_TO_FABRIC_IDENTITY: Record<Role, string> = {
  Admin: "fund-admin",
  FundManager: "fund-manager",
  Donor: "fund-donor",
};
