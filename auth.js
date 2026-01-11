import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "2dc8b5f38231edc5ff442d76452282f4e4c544971891ae66d3718fbd034f98ef16386e2f855129297bf781251f8705d9";

export function generateToken(username) {
  return jwt.sign(
    { username },
    SECRET,
    { expiresIn: "2h" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
