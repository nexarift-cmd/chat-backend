import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { generateToken, verifyToken } from "./auth.js";

const app = express();
const server = http.createServer(app);

/* 🔒 CORS — bloque les sites copiés */
const ALLOWED_ORIGINS = [
  "https://poetic-granita-8b842f.netlify.app" // à remplacer
];

app.use(cors({
  origin: ALLOWED_ORIGINS
}));

app.use(express.json());

/* ===== API LOGIN ===== */
app.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username || username.length > 20) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const token = generateToken(username);
  res.json({ token });
});

/* ===== SOCKET.IO ===== */
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS
  }
});

/* 🔐 AUTH SOCKET */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));

    const decoded = verifyToken(token);
    socket.username = decoded.username;

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

/* ===== CHAT LOGIC ===== */
io.on("connection", (socket) => {
  console.log("Connected:", socket.username);

  socket.broadcast.emit("systemMessage", {
    text: `${socket.username} a rejoint`
  });

  socket.on("sendMessage", (msg) => {
    if (!msg || msg.length > 500) return;

    io.emit("newMessage", {
      user: socket.username,
      text: msg,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("systemMessage", {
      text: `${socket.username} a quitté`
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("Secure server running on", PORT)
);
