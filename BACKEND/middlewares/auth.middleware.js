import jwt from "jsonwebtoken";
import redisClient from "../services/redis.service.js";

export const authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.token ||
      (authHeader?.startsWith("bearer ") ? authHeader.split(" ")[1] : null);

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Check Redis for blacklisted token
    const isBlackListed = await redisClient.get(token);
    if (isBlackListed) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      return res.status(401).json({ error: "Token blacklisted. Please log in again." });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    } else {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
};
