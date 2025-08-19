import { db } from "../config/firebase.js";
import { generarUserId } from "../services/userService.js";

async function seed() {
    console.log("Iniciando el seeder de usuarios...");
    const users = [
        { nombre: "Angelo Gaviria", correo: "angelo@example.com", rol: "empleado", departamento: "Desarrollo", idEmpresa: "0194" },
        { nombre: "Marla Perez", correo: "marla@example.com", rol: "soporte", departamento: "Soporte", idEmpresa: "0073" },
        { nombre: "Carlos Rodriguez", correo: "carlos@example.com", rol: "ventas", departamento: "Ventas", idEmpresa: "0088" },
    ];

    const batch = db.batch();
    let usersToCreateCount = 0;

    for (const u of users) {
        // Validación 1: Verificar que los datos básicos no estén vacíos
        if (!u.correo || !u.nombre) {
            console.warn(`Datos incompletos para el usuario: ${JSON.stringify(u)}. Saltando.`);
            continue;
        }

        const userId = generarUserId(u.nombre, u.departamento, u.idEmpresa);
        const userRef = db.collection("usuarios").doc(userId);

        // Validación 2: Verificar si el ID de usuario ya existe
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            console.log(`El usuario con ID ${userId} ya existe. Saltando.`);
            continue;
        }

        // Validación 3: Verificar si el correo electrónico ya está en uso
        const emailQuery = db.collection("usuarios").where("correo", "==", u.correo);
        const snapshot = await emailQuery.get();
        if (!snapshot.empty) {
            console.log(`El correo ${u.correo} ya está en uso por otro usuario. Saltando.`);
            continue;
        }

        // Si todas las validaciones pasan, se añade al batch
        usersToCreateCount++;
        batch.set(userRef, {
            nickname: u.nombre,
            correo: u.correo,
            rol: u.rol,
            departamento: u.departamento,
            fotoPerfilURL: "",
            estado: "offline",
            fechaRegistro: new Date()
        });
        console.log(`Usuario válido para creación: ${userId} - ${u.nombre}`);
    }

    if (usersToCreateCount > 0) {
        await batch.commit();
        console.log(`¡${usersToCreateCount} usuarios creados exitosamente!`);
    } else {
        console.log("No se crearon nuevos usuarios. La base de datos ya parece estar actualizada.");
    }

    process.exit(0);
}

seed().catch(err => {
    console.error("Error durante el seeding:", err);
    process.exit(1);
});