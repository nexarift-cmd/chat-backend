import jwt from "jsonwebtoken";

// ⚠️ ne mets jamais ton vrai secret ici !
const SECRET = process.env.JWT_SECRET;

export function generateToken(username) {
  return jwt.sign({ username }, SECRET, { expiresIn: "2h" });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
