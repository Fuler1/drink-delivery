import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const ACCESS_TTL = "15m";
export const REFRESH_TTL_DAYS = 30;

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a refresh token (opaque random string) and persist its hash.
 * Returns { token, id } where `token` is what we send to the client.
 */
export async function issueRefreshToken(userId, replacesId = null) {
  const raw = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);

  // Sign it as JWT too for cheap integrity + userId readability
  const token = jwt.sign({ sub: userId, t: raw }, REFRESH_SECRET, {
    expiresIn: `${REFRESH_TTL_DAYS}d`,
  });

  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, tokenHash, expires]
  );
  const id = rows[0].id;

  if (replacesId) {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), replaced_by = $1
       WHERE id = $2`,
      [id, replacesId]
    );
  }

  return { token, id };
}

/**
 * Verify a refresh token from client: valid JWT + row exists + not revoked + not expired.
 * Returns the DB row or throws.
 */
export async function verifyRefreshToken(clientToken) {
  let payload;
  try {
    payload = jwt.verify(clientToken, REFRESH_SECRET);
  } catch {
    throw new Error("invalid_refresh");
  }
  if (!payload?.t || !payload?.sub) {
    throw new Error("invalid_refresh");
  }
  const tokenHash = hashToken(payload.t);
  const { rows } = await query(
    `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at,
            u.id AS uid, u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  if (rows.length === 0) throw new Error("invalid_refresh");
  const row = rows[0];
  if (row.revoked_at) throw new Error("revoked_refresh");
  if (new Date(row.expires_at) < new Date()) throw new Error("expired_refresh");
  if (row.user_id !== payload.sub) throw new Error("invalid_refresh");
  return {
    tokenId: row.id,
    user: { id: row.uid, email: row.email, role: row.role },
  };
}

export async function revokeRefreshToken(clientToken) {
  try {
    const payload = jwt.verify(clientToken, REFRESH_SECRET);
    const tokenHash = hashToken(payload.t);
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  } catch {
    // swallow — logout should be idempotent
  }
}

export async function revokeAllForUser(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
