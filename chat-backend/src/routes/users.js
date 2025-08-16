import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

// Buscar usuarios por término de búsqueda
router.get('/search', async (req, res) => {
  try {
    const { q, currentUserId } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json([]);
    }
    
    const usersSnapshot = await db.collection('usuarios').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = { id: doc.id, ...doc.data() };
      
      // Excluir al usuario actual de los resultados
      if (userData.id === currentUserId) {
        return;
      }
      
      // Buscar en correo, nombre, y nickname
      const searchTerm = q.toLowerCase();
      if (
        (userData.correo && userData.correo.toLowerCase().includes(searchTerm)) ||
        (userData.nombre && userData.nombre.toLowerCase().includes(searchTerm)) ||
        (userData.nickname && userData.nickname.toLowerCase().includes(searchTerm)) ||
        (userData.departamento && userData.departamento.toLowerCase().includes(searchTerm))
      ) {
        users.push(userData);
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error al buscar usuarios:', error);
    res.status(500).json({ message: 'Error al buscar usuarios' });
  }
});

// Obtener todos los usuarios excepto el actual
router.get('/', async (req, res) => {
  try {
    const { excludeId } = req.query;
    
    const usersSnapshot = await db.collection('usuarios').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = { id: doc.id, ...doc.data() };
      if (userData.id !== excludeId) {
        users.push(userData);
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

export default router;