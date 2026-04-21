import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET;

if (!ACCESS_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

// 🔐 Middleware: wymaga zalogowanego użytkownika
export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_token" });
    }

    const token = header.slice(7);

    const payload = jwt.verify(token, ACCESS_SECRET);

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "token_expired" });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "invalid_token" });
    }

    console.error("[auth] error:", err);
    return res.status(401).json({ error: "unauthorized" });
  }
}

// 🔐 Middleware: sprawdza rolę
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  };
}