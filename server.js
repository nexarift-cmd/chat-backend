const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

/* =====================
   STOCKAGE TEMPORAIRE
===================== */

// socket.id -> username
const users = {};

// username -> socket.id
const sockets = {};

// username -> [friends]
const friends = {};

// username -> [friend requests]
const friendRequests = {};

// dmRoom -> messages
const dmMessages = {};

// groupId -> { name, members, messages }
const groups = {};

/* =====================
   UTILS
===================== */

function getDMRoom(a, b) {
  return [a, b].sort().join("_");
}

/* =====================
   SOCKET.IO
===================== */

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  /* ---------- LOGIN ---------- */
  socket.on("login", (username) => {
    users[socket.id] = username;
    sockets[username] = socket.id;

    friends[username] ??= [];
    friendRequests[username] ??= [];

    io.emit("statusUpdate", { user: username, online: true });
  });

  /* ---------- SEARCH USER ---------- */
  socket.on("searchUser", (username, cb) => {
    cb(Boolean(sockets[username]));
  });

  /* ---------- FRIEND REQUEST ---------- */
  socket.on("sendFriendRequest", (toUser) => {
    const fromUser = users[socket.id];
    if (!fromUser || !sockets[toUser]) return;

    if (!friendRequests[toUser].includes(fromUser)) {
      friendRequests[toUser].push(fromUser);
      io.to(sockets[toUser]).emit("friendRequest", fromUser);
    }
  });

  socket.on("acceptFriend", (fromUser) => {
    const toUser = users[socket.id];
    if (!toUser) return;

    friends[toUser].push(fromUser);
    friends[fromUser].push(toUser);

    friendRequests[toUser] =
      friendRequests[toUser].filter(u => u !== fromUser);

    io.to(sockets[fromUser]).emit("friendAccepted", toUser);
  });

  /* ---------- PRIVATE MESSAGES ---------- */
  socket.on("joinDM", (friend) => {
    const me = users[socket.id];
    if (!me) return;

    const room = getDMRoom(me, friend);
    socket.join(room);

    socket.emit("dmHistory", dmMessages[room] || []);
  });

  socket.on("privateMessage", ({ to, message }) => {
    const from = users[socket.id];
    if (!from || !friends[from].includes(to)) return;

    const room = getDMRoom(from, to);
    dmMessages[room] ??= [];

    const msg = {
      from,
      message,
      time: Date.now()
    };

    dmMessages[room].push(msg);
    io.to(room).emit("privateMessage", msg);
  });

  /* ---------- TYPING ---------- */
  socket.on("typing", ({ to, typing }) => {
    const from = users[socket.id];
    if (!from || !sockets[to]) return;

    io.to(sockets[to]).emit("typing", { from, typing });
  });

  /* ---------- GROUPS ---------- */
  socket.on("createGroup", ({ name, members }, cb) => {
    const id = Date.now().toString();

    groups[id] = {
      name,
      members,
      messages: []
    };

    members.forEach(user => {
      if (sockets[user]) {
        io.to(sockets[user]).emit("groupCreated", {
          id,
          name
        });
      }
    });

    cb(id);
  });

  socket.on("joinGroup", (groupId) => {
    if (!groups[groupId]) return;
    socket.join("group_" + groupId);
    socket.emit("groupHistory", groups[groupId].messages);
  });

  socket.on("groupMessage", ({ groupId, message }) => {
    const from = users[socket.id];
    if (!groups[groupId]) return;

    const msg = {
      from,
      message,
      time: Date.now()
    };

    groups[groupId].messages.push(msg);
    io.to("group_" + groupId).emit("groupMessage", msg);
  });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (!username) return;

    delete sockets[username];
    delete users[socket.id];

    io.emit("statusUpdate", { user: username, online: false });
  });
});

/* =====================
   START SERVER
===================== */

server.listen(PORT, () => {
  console.log("🚀 Socket.IO server running on port", PORT);
});
