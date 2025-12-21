const express = require("express");
const app = express();
const http = require("http").createServer(app);

const io = require("socket.io")(http, {
  cors: {
    origin: "*"
  }
});

let users = [];

io.on("connection", (socket) => {

  socket.on("join", (username) => {
    socket.username = username;
    users.push(username);
    io.emit("users", users);
  });

  socket.on("message", (msg) => {
    io.emit("message", msg);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      users = users.filter(u => u !== socket.username);
      io.emit("users", users);
    }
  });

});

http.listen(3000, () => {
  console.log("Socket.IO server running");
});
