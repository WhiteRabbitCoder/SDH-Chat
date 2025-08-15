import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

// GET /api/users/search?q=...
router.get('/search', async (req, res) => {
  const { q, currentUserId } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'El parámetro de búsqueda "q" (correo) es requerido.' });
  }

  try {
    // Busca un usuario por su correo electrónico (coincidencia exacta)
    const userQuery = await db.collection('usuarios').where('correo', '==', q).limit(1).get();

    if (userQuery.empty) {
      return res.json([]); // No se encontró ningún usuario con ese correo
    }

    const userDoc = userQuery.docs[0];

    // Excluir al usuario actual de los resultados
    if (userDoc.id === currentUserId) {
      return res.json([]);
    }

    // Devolver el usuario encontrado en un array
    res.json([{ id: userDoc.id, ...userDoc.data() }]);

  } catch (error) {
    console.error("Error al buscar usuario por correo:", error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;