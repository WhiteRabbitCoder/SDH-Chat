import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initializeSocket } from './sockets/chat.js';
import authRoutes from './routes/auth.js';
import convRoutes from './routes/conversations.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.FRONTEND_URL || "http://localhost:5173"];

console.log(`Entorno: ${NODE_ENV}, Puerto: ${PORT}`);
console.log(`Orígenes permitidos para CORS: ${allowedOrigins.join(', ')}`);

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`Origen bloqueado por CORS: ${origin}`);
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

app.use(express.json());

initializeSocket(io);

app.get('/', (req, res) => {
  res.send({
    status: 'online',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', convRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});