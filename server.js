const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Root redirects to a new room
app.get('/', (req, res) => {
  const roomId = crypto.randomBytes(3).toString('hex');
  res.redirect(`/${roomId}`);
});

// Any path serves the game (room ID parsed client-side)
app.get('/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Multiplayer state ---
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join', ({ roomId, character }) => {
    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);

    const playerData = {
      id: socket.id,
      x: 200 + Math.random() * 600,
      y: 100,
      vx: 0,
      vy: 0,
      state: 'idle',
      flipX: false,
      character // seed for appearance
    };
    room.set(socket.id, playerData);

    // Send all existing players to the newcomer
    socket.emit('currentPlayers', Object.fromEntries(room));

    // Notify others about the new player
    socket.to(roomId).emit('playerJoined', playerData);

    io.to(roomId).emit('playerCount', room.size);
  });

  socket.on('update', (data) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const room = rooms.get(currentRoom);
    const player = room.get(socket.id);
    if (player) {
      Object.assign(player, data);
      socket.to(currentRoom).emit('playerMoved', { id: socket.id, ...data });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('playerLeft', socket.id);
        io.to(currentRoom).emit('playerCount', room.size);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Clown Platformer running on http://localhost:${PORT}`);
});
