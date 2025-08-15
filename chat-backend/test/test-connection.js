import { db } from '../src/config/firebase.js';

async function checkFirebaseConnection() {
    console.log('Intentando conectar con Firebase...');
    try {
        // Una operación simple para verificar la conexión: listar colecciones.
        const collections = await db.listCollections();

        console.log('✅ ¡Conexión con Firebase exitosa!');

        if (collections.length === 0) {
            console.log('ℹ️ No se encontraron colecciones en la base de datos (esto es normal si es nueva).');
        } else {
            console.log('🗂️ Colecciones encontradas:');
            collections.forEach(collection => {
                console.log(`  - ${collection.id}`);
            });
        }

    } catch (error) {
        console.error('❌ Error al conectar con Firebase:');
        console.error('=======================================');
        console.error('Posibles causas:');
        console.error('  1. El archivo "serviceAccountKey.json" no se encuentra en la ruta correcta.');
        console.error('  2. El contenido del archivo "serviceAccountKey.json" es inválido.');
        console.error('  3. No tienes permisos para acceder a la base de datos de Firestore.');
        console.error('  4. Problemas de red o firewall.');
        console.error('\nError detallado:', error.message);
    }
}

checkFirebaseConnection();