import type { Role } from "@prisma/client";

/**
 * Platform permissions. Checked on the server by requirePermission();
 * the UI may hide what a role can't do, but that is never the control.
 */
export type Permission =
  | "content.moderate"
  | "users.suspend"
  | "users.ban"
  | "users.roles"
  | "communities.manage"
  | "catalog.manage"
  | "curation.manage"
  | "platform.config"
  | "system.view"
  | "audit.view"
  | "analytics.view";

const ALL: Permission[] = [
  "content.moderate", "users.suspend", "users.ban", "users.roles", "communities.manage", "catalog.manage",
  "curation.manage", "platform.config", "system.view", "audit.view", "analytics.view",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  USER: new Set(),
  MODERATOR: new Set(["content.moderate", "users.suspend", "analytics.view", "communities.manage", "catalog.manage"]),
  ADMIN: new Set(ALL),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export const isStaff = (role: Role) => role !== "USER";
