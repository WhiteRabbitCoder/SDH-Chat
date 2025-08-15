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

    for (const u of users) {
        const userId = generarUserId(u.nombre, u.departamento, u.idEmpresa);
        const userRef = db.collection("usuarios").doc(userId);

        batch.set(userRef, {
            nickname: u.nombre,
            correo: u.correo,
            rol: u.rol,
            departamento: u.departamento,
            fotoPerfilURL: "",
            estado: "offline",
            fechaRegistro: new Date()
        });
        console.log(`Usuario preparado para creación: ${userId} - ${u.nombre}`);
    }

    await batch.commit();
    console.log("¡Usuarios creados exitosamente!");
    process.exit(0);
}

seed().catch(err => {
    console.error("Error durante el seeding:", err);
    process.exit(1);
});