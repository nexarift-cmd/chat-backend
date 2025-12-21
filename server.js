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

/* ---------- DONNÉES EN MÉMOIRE ---------- */

const users = {};          // username -> socket.id
const friends = {};        // username -> [amis]
const dmHistory = {};      // "user1|user2" -> messages
const groups = {};         // groupId -> { name, members, messages }

/* ---------- SOCKET ---------- */

io.on("connection", (socket) => {

  /* LOGIN */
  socket.on("login", (username) => {
    socket.username = username;
    users[username] = socket.id;

    if (!friends[username]) friends[username] = [];

    console.log(username, "connecté");
  });

  /* ---------- DEMANDE D’AMI ---------- */

  socket.on("friendRequest", (toUser) => {
    const fromUser = socket.username;
    const targetSocket = users[toUser];

    if (!targetSocket) return;

    io.to(targetSocket).emit("friendRequest", fromUser);
  });

  socket.on("acceptFriend", (fromUser) => {
    const toUser = socket.username;

    friends[toUser].push(fromUser);
    friends[fromUser].push(toUser);

    io.to(users[fromUser]).emit("friendAccepted", toUser);
    socket.emit("friendAccepted", fromUser);
  });

  /* ---------- DM ---------- */

  socket.on("joinDM", (otherUser) => {
    const key = [socket.username, otherUser].sort().join("|");
    socket.join(key);

    socket.emit("dmHistory", dmHistory[key] || []);
  });

  socket.on("privateMessage", ({ to, message }) => {
    const from = socket.username;
    const key = [from, to].sort().join("|");

    if (!dmHistory[key]) dmHistory[key] = [];

    const msg = { from, message };
    dmHistory[key].push(msg);

    io.to(key).emit("privateMessage", msg);
  });

  /* ---------- GROUPES ---------- */

  socket.on("createGroup", ({ name, members }, callback) => {
    const id = Date.now().toString();

    groups[id] = {
      name,
      members,
      messages: []
    };

    callback(id);
  });

  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
    socket.emit("groupHistory", groups[groupId]?.messages || []);
  });

  socket.on("groupMessage", ({ groupId, message }) => {
    const msg = { from: socket.username, message };
    groups[groupId].messages.push(msg);
    io.to(groupId).emit("groupMessage", msg);
  });

  /* ---------- TYPING ---------- */

  socket.on("typing", ({ to, typing }) => {
    const target = users[to];
    if (target) {
      io.to(target).emit("typing", {
        from: socket.username,
        typing
      });
    }
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
      console.log(socket.username, "déconnecté");
    }
  });
});

/* ---------- SERVER ---------- */

server.listen(3000, () => {
  console.log("Socket.IO server running on port 3000");
});
