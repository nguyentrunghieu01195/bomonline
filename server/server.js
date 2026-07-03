import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from Vite build in production (unified deploy)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

const JWT_SECRET = 'boom_neon_super_secret_key_2026';
const DB_FILE = path.join(__dirname, 'database.json');

// ==========================================================================
// DATABASE UTILS
// ==========================================================================
let inMemoryDB = { users: [] };

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDB, null, 2));
      } catch (e) {
        // Silently ignore write failures on initial database setup
      }
      return inMemoryDB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    inMemoryDB = JSON.parse(data || '{"users":[]}');
    return inMemoryDB;
  } catch (err) {
    console.warn('DB read failed, using in-memory fallback:', err.message);
    return inMemoryDB;
  }
}

function writeDB(data) {
  inMemoryDB = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('DB write failed, in-memory state updated only:', err.message);
  }
}

// ==========================================================================
// REST APIS FOR AUTH
// ==========================================================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = readDB();
    const existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      username,
      password: hashedPassword,
      wins: 0,
      kills: 0,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);

    const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: newUser.id, username: newUser.username, wins: 0, kills: 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, wins: user.wins || 0, kills: user.kills || 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, wins: user.wins || 0, kills: user.kills || 0 });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  const db = readDB();
  const list = db.users
    .map(u => ({ username: u.username, wins: u.wins || 0, kills: u.kills || 0 }))
    .sort((a, b) => b.wins - a.wins || b.kills - a.kills)
    .slice(0, 10);
  res.json(list);
});

// Update User Stats (called when match ends)
function updateUserStats(userId, isWinner, killsAdded) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    if (isWinner) user.wins = (user.wins || 0) + 1;
    user.kills = (user.kills || 0) + killsAdded;
    writeDB(db);
  }
}

// ==========================================================================
// SOCKET.IO LOBBY & GAME ROOMS
// ==========================================================================
const rooms = {}; // key: roomCode, value: roomState

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  let currentRoomCode = null;
  let userProfile = null;

  socket.on('authenticate', (profile) => {
    userProfile = profile; // { id, username }
    console.log(`Socket ${socket.id} authenticated as ${profile.username}`);
  });

  // 1. Create Room
  socket.on('create_room', ({ characterId }) => {
    if (!userProfile) return;

    const roomCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    
    rooms[roomCode] = {
      code: roomCode,
      status: 'waiting', // 'waiting', 'playing'
      hostId: userProfile.id,
      players: [
        {
          id: userProfile.id,
          username: userProfile.username,
          characterId: characterId || 'cyber_boy',
          ready: true, // host is always ready
          socketId: socket.id
        }
      ],
      grid: null
    };

    currentRoomCode = roomCode;
    socket.join(roomCode);
    
    socket.emit('room_created', rooms[roomCode]);
    broadcastRoomList();
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, characterId }) => {
    if (!userProfile) return;

    const room = rooms[roomCode];
    if (!room) {
      return socket.emit('join_error', 'Phòng không tồn tại!');
    }
    if (room.status === 'playing') {
      return socket.emit('join_error', 'Trận đấu đã bắt đầu!');
    }
    if (room.players.length >= 4) {
      return socket.emit('join_error', 'Phòng đã đầy (tối đa 4 người)!');
    }

    // Check if user already in room
    const exists = room.players.some(p => p.id === userProfile.id);
    if (!exists) {
      room.players.push({
        id: userProfile.id,
        username: userProfile.username,
        characterId: characterId || 'cyber_boy',
        ready: false,
        socketId: socket.id
      });
    }

    currentRoomCode = roomCode;
    socket.join(roomCode);
    
    io.to(roomCode).emit('room_update', room);
    broadcastRoomList();
  });

  // 3. Ready Toggle
  socket.on('toggle_ready', () => {
    if (!currentRoomCode || !userProfile) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    const p = room.players.find(p => p.id === userProfile.id);
    if (p && p.id !== room.hostId) { // host is always ready
      p.ready = !p.ready;
      io.to(currentRoomCode).emit('room_update', room);
    }
  });

  // 4. Change Character Selection
  socket.on('change_character', ({ characterId }) => {
    if (!currentRoomCode || !userProfile) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    const p = room.players.find(p => p.id === userProfile.id);
    if (p) {
      p.characterId = characterId;
      io.to(currentRoomCode).emit('room_update', room);
    }
  });

  // 5. Start Game
  socket.on('start_game', ({ grid }) => {
    if (!currentRoomCode || !userProfile) return;
    const room = rooms[currentRoomCode];
    if (!room || room.hostId !== userProfile.id) return;

    // Check if all players are ready
    const allReady = room.players.every(p => p.ready);
    if (!allReady) return socket.emit('game_error', 'Tất cả người chơi phải Sẵn sàng!');

    room.status = 'playing';
    room.grid = grid;

    // Spawn spots configuration
    const spawnSpots = [
      { x: 1, y: 1 },    // Top-Left
      { x: 13, y: 11 },  // Bottom-Right
      { x: 13, y: 1 },   // Top-Right
      { x: 1, y: 11 }    // Bottom-Left
    ];

    // Assign spawn positions
    room.players.forEach((p, idx) => {
      p.spawnX = spawnSpots[idx].x;
      p.spawnY = spawnSpots[idx].y;
    });

    io.to(currentRoomCode).emit('game_start', {
      grid: room.grid,
      players: room.players
    });
    broadcastRoomList();
  });

  // 6. Realtime Game Synchronization Events
  socket.on('player_move', (data) => {
    if (!currentRoomCode) return;
    // Broadcast position updates to other players in the room
    socket.to(currentRoomCode).emit('player_update', {
      id: userProfile?.id,
      ...data
    });
  });

  socket.on('place_bomb', (data) => {
    if (!currentRoomCode) return;
    // Broadcast bomb placement details
    io.to(currentRoomCode).emit('bomb_placed', {
      ownerId: userProfile?.id,
      ...data
    });
  });

  socket.on('brick_destroyed', (data) => {
    if (!currentRoomCode) return;
    // Sync block destruction across players
    socket.to(currentRoomCode).emit('brick_destroyed', data);
  });

  socket.on('pickup_powerup', (data) => {
    if (!currentRoomCode) return;
    // Broadcast item collected to clean up globally
    io.to(currentRoomCode).emit('powerup_collected', {
      playerId: userProfile?.id,
      ...data
    });
  });

  socket.on('player_damaged', ({ lives }) => {
    if (!currentRoomCode || !userProfile) return;
    io.to(currentRoomCode).emit('player_status', {
      playerId: userProfile.id,
      lives,
      dead: lives <= 0
    });
  });

  socket.on('game_over_client', ({ winnerId, kills }) => {
    if (!currentRoomCode || !userProfile) return;
    const room = rooms[currentRoomCode];
    if (!room || room.status !== 'playing') return;

    room.status = 'waiting';
    // Mark players as not ready again for next round (except host)
    room.players.forEach(p => {
      if (p.id !== room.hostId) p.ready = false;
    });

    // Update statistics in Database
    const isWinner = (winnerId === userProfile.id);
    updateUserStats(userProfile.id, isWinner, kills || 0);

    io.to(currentRoomCode).emit('game_over', { winnerId, roomUpdate: room });
    broadcastRoomList();
  });

  // 7. Get Room List
  socket.on('get_rooms', () => {
    socket.emit('room_list', getActiveRoomList());
  });

  // 8. Disconnect / Leave Room
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleLeaveRoom();
  });

  socket.on('leave_room', () => {
    handleLeaveRoom();
  });

  function handleLeaveRoom() {
    if (!currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    // Remove player
    room.players = room.players.filter(p => p.socketId !== socket.id);
    socket.leave(currentRoomCode);

    if (room.players.length === 0) {
      delete rooms[currentRoomCode];
    } else {
      // Re-assign host if host left
      if (room.hostId === userProfile?.id) {
        room.hostId = room.players[0].id;
        room.players[0].ready = true; // Host is always ready
      }
      io.to(currentRoomCode).emit('room_update', room);
      
      // If playing and players count drop, check victory or stop game
      if (room.status === 'playing') {
        const alivePlayers = room.players;
        if (alivePlayers.length <= 1) {
          io.to(currentRoomCode).emit('game_over', { 
            winnerId: alivePlayers[0]?.id || null, 
            roomUpdate: room 
          });
          room.status = 'waiting';
          room.players.forEach(p => {
            if (p.id !== room.hostId) p.ready = false;
          });
        }
      }
    }

    currentRoomCode = null;
    broadcastRoomList();
  }

  function getActiveRoomList() {
    return Object.values(rooms).map(r => ({
      code: r.code,
      playerCount: r.players.length,
      status: r.status,
      hostName: r.players.find(p => p.id === r.hostId)?.username || 'Host'
    }));
  }

  function broadcastRoomList() {
    io.emit('room_list', getActiveRoomList());
  }
});

// SPA routing fallback - serve index.html for any frontend route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server matches running at http://localhost:${PORT}`);
});
