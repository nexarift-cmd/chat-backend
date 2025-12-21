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

/* =======================
   STOCKAGE (TEMPORAIRE)
======================= */

const users = {}; // socketId -> user
const usersByName = {}; // username -> socketId
const friends = {}; // username -> [friends]
const friendRequests = {}; // username -> [requests]

const messagesDM = {}; // roomId -> messages[]
const groups = {}; // groupId -> { name, members, messages }

/* =======================
   UTILS
======================= */

function dmRoom(a, b) {
  return [a, b].sort().join("_");
}

/* =======================
   SOCKET.IO
======================= */

io.on("connection", (socket) => {
  console.log("🟢 Connecté :", socket.id);

  /* ---------- LOGIN ---------- */
  socket.on("login", (username) => {
    users[socket.id] = { username };
    usersByName[username] = socket.id;

    friends[username] ??= [];
    friendRequests[username] ??= [];

    io.emit("statusUpdate", {
      user: username,
      online: true
    });
  });

  /* ---------- RECHERCHE UTILISATEUR ---------- */
  socket.on("searchUser", (username, cb) => {
    cb(usersByName[username] ? true : false);
  });

 socket.on("acceptFriend", (fromUser) => {
  const toUser = users[socket.id]?.username;
  if (!toUser) return;

  friends[toUser] ??= [];
  friends[fromUser] ??= [];

  if (!friends[toUser].includes(fromUser)) {
    friends[toUser].push(fromUser);
    friends[fromUser].push(toUser);
  }

  friendRequests[toUser] =
    (friendRequests[toUser] || []).filter(u => u !== fromUser);

  // Notifier les deux
  socket.emit("friendAccepted", fromUser);

  const fromSocket = usersByName[fromUser];
  if (fromSocket) {
    io.to(fromSocket).emit("friendAccepted", toUser);
  }
});

  /* ---------- MESSAGES PRIVÉS ---------- */
  socket.on("joinDM", (friend) => {
    const me = users[socket.id].username;
    const room = dmRoom(me, friend);

    socket.join(room);

    socket.emit("dmHistory", messagesDM[room] || []);
  });

  socket.on("privateMessage", ({ to, message }) => {
    const from = users[socket.id].username;
    const room = dmRoom(from, to);

    messagesDM[room] ??= [];

    const msg = {
      from,
      message,
      time: Date.now()
    };

    messagesDM[room].push(msg);
    io.to(room).emit("privateMessage", msg);
  });

  /* ---------- TYPING ---------- */
  socket.on("typing", ({ to, typing }) => {
    io.to(usersByName[to]).emit("typing", {
      from: users[socket.id].username,
      typing
    });
  });

  /* ---------- GROUPES ---------- */
  socket.on("createGroup", ({ name, members }, cb) => {
    const id = Date.now().toString();

    groups[id] = {
      name,
      members,
      messages: []
    };

    members.forEach(m => {
      io.to(usersByName[m]).emit("groupCreated", {
        id,
        name
      });
    });

    cb(id);
  });

  socket.on("joinGroup", (groupId) => {
    socket.join("group_" + groupId);
    socket.emit("groupHistory", groups[groupId].messages);
  });

  socket.on("groupMessage", ({ groupId, message }) => {
    const from = users[socket.id].username;

    const msg = {
      from,
      message,
      time: Date.now()
    };

    groups[groupId].messages.push(msg);

    io.to("group_" + groupId).emit("groupMessage", msg);
  });

  /* ---------- DÉCONNEXION ---------- */
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    io.emit("statusUpdate", {
      user: user.username,
      online: false
    });

    delete usersByName[user.username];
    delete users[socket.id];
  });
});

/* =======================
   START
======================= */

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
