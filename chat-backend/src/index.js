import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initializeSocket } from './sockets/chat.js'; // <-- CORRECCIÓN 1: Importación nombrada
import authRoutes from './routes/auth.js';
import convRoutes from './routes/conversations.js';
import userRoutes from './routes/users.js';

const app = express();
const server = http.createServer(app);

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST"]
};
app.use(cors(corsOptions));

// Configuración de Socket.IO
const io = new Server(server, {
  cors: corsOptions
});

// Middlewares de Express
app.use(express.json());

// Inicializar los Sockets
initializeSocket(io); 

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/conversations', convRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en ${PORT}`);
});