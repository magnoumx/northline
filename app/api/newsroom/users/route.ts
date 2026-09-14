import { getD1Binding } from "@/db";
import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["user.manage", "audit.view"]);
  if (!access.allowed) return access.response;
  try {
    const db = await getD1Binding();
    const [users, roles] = await Promise.all([
      db.prepare(
        `SELECT u.id, u.email, u.display_name AS displayName, u.status,
          u.created_at AS createdAt, u.updated_at AS updatedAt,
          COALESCE(json_group_array(DISTINCT r.key), '[]') AS rolesJson
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT 250`,
      ).all(),
      db.prepare(
        `SELECT r.id, r.key, r.name, r.scope, r.description, r.is_system AS isSystem,
          COUNT(DISTINCT rp.permission_id) AS permissionCount
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
         GROUP BY r.id ORDER BY r.scope, r.name`,
      ).all(),
    ]);
    return Response.json(
      { users: users.results, roles: roles.results },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "Staff directory is temporarily unavailable." });
  }
}
