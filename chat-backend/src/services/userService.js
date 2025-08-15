/**
 * Genera un ID de usuario único basado en el nombre, departamento y un ID de empresa.
 * El formato es: NNN-DDD-IDEMPRESAsufijoAleatorio
 * @param {string} nombre - Nombre del usuario.
 * @param {string} departamento - Departamento del usuario.
 * @param {string} idInterno - ID interno o de la empresa.
 * @returns {string} El ID de usuario generado.
 */
export function generarUserId(nombre, departamento, idInterno) {
    const normalize = (s) => (s || "").trim().toUpperCase().replace(/\s+/g, "");
    const namePart = normalize(nombre).slice(0, 3) || "USR";
    const deptPart = normalize(departamento).slice(0, 3) || "DEP";
    // Genera un sufijo aleatorio de 3 caracteres alfanuméricos
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${namePart}-${deptPart}-${idInterno}${suffix}`;
}