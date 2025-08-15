import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "El campo 'userId' es requerido." });
  }

  try {
    const userDocRef = db.collection("usuarios").doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Actualiza el estado a 'online'
    await userDocRef.update({ estado: "online" });

    res.json({ user: { id: userDoc.id, ...userDoc.data(), estado: 'online' } });
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "El campo 'userId' es requerido." });
  }

  try {
    const userDocRef = db.collection("usuarios").doc(userId);
    // Simplemente actualizamos el estado a 'offline'
    await userDocRef.update({ estado: "offline" });

    res.status(200).json({ message: "Logout exitoso." });
  } catch (error) {
    console.error("Error en el logout:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;