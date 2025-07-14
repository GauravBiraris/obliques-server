const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Add health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ 
    message: 'Obliques Signaling Server',
    status: 'running',
    rooms: rooms.size
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "https://oblique-phi.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', ({ passkey, playerName, opponentName }) => {
    console.log(`Player ${playerName} joining room ${passkey}`);
    
    const roomId = passkey;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        players: [],
        host: null
      });
    }

    const room = rooms.get(roomId);
    
    if (room.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      opponentName: opponentName
    };

    room.players.push(player);
    socket.join(roomId);

    if (room.players.length === 1) {
      room.host = socket.id;
      socket.emit('room-joined', { isHost: true, roomId });
    } else {
      socket.emit('room-joined', { isHost: false, roomId });
      socket.to(roomId).emit('player-joined');
    }

    socket.on('signal', (data) => {
      socket.to(roomId).emit('signal', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
