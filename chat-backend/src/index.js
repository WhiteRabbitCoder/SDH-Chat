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


// Configuración de variables de entorno
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Permitir múltiples orígenes para CORS (útil para desarrollo y producción)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [process.env.FRONTEND_URL || "http://localhost:5173"];

console.log(`Entorno: ${NODE_ENV}, Puerto: ${PORT}`);
console.log(`Orígenes permitidos para CORS: ${allowedOrigins.join(', ')}`);

const app = express();
const server = http.createServer(app);

// Configuración de CORS mejorada
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como las aplicaciones móviles o curl)
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

// Configuración de Socket.IO con las mismas opciones de CORS
const io = new Server(server, {
  cors: corsOptions
});

// Middlewares de Express
app.use(express.json());

// Inicializar los Sockets
initializeSocket(io); 

// Ruta simple para verificar que el servidor está en funcionamiento
app.get('/', (req, res) => {
  res.send({
    status: 'online',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/conversations', convRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});