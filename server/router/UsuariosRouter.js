const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

// === 🛡️ FUNCIÓN AUXILIAR PARA REGISTRAR EN BITÁCORA ===
const registrarBitacora = (id_usuario, tipo_movimiento, ejecutado_por, detalles, callback) => {
    const sqlBitacora = `
        INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento) 
        VALUES (?, ?, ?, ?, NOW())
    `;
    
    db.query(sqlBitacora, [id_usuario, tipo_movimiento, ejecutado_por, detalles], (err, result) => {
        if (err) {
            console.error("❌ Error crítico al insertar en la bitácora de base de datos:", err);
            if (callback) callback(err);
        } else {
            console.log(`✅ Bitácora registrada con éxito: [${tipo_movimiento}] por [${ejecutado_por}] para Usuario ID ${id_usuario}`);
            if (callback) callback(null, result);
        }
    });
};

// =========================================================================
// 🔐 ENDPOINT: INICIO DE SESIÓN (LOGIN) 
// =========================================================================
router.post("/login", (req, res) => {
    const { correo, clave } = req.body;

    // Validación de campos vacíos
    if (!correo || !clave) {
        return res.status(400).send({ error: "Por favor, ingrese el correo electrónico y la contraseña." });
    }

    const correoLimpio = correo.toLowerCase().trim();

    // Consulta con funciones de limpieza SQL para evitar fallos de formato
    db.query('SELECT * FROM usuarios WHERE LOWER(TRIM(correo)) = ?', [correoLimpio], (err, result) => {
        if (err) {
            console.error("❌ Error en base de datos al validar Login:", err);
            return res.status(500).send({ error: "Error interno del servidor al consultar credenciales." });
        }

        // Si el correo no existe
        if (result.length === 0) {
            return res.status(401).send({ error: "El correo electrónico ingresado no existe." });
        }

        const usuario = result[0];

        // Verificación de clave (Directa/Texto plano)
        if (usuario.clave !== clave) {
            return res.status(401).send({ error: "La contraseña es incorrecta." });
        }

        // Verificación del estado del usuario
        if (usuario.estado && usuario.estado.trim().toLowerCase() !== 'activo') {
            return res.status(403).send({ error: "Este usuario se encuentra inactivo. Comuníquese con el Administrador." });
        }

        // Registrar el inicio de sesión exitoso en la auditoría
        const detallesLogin = `El usuario [${usuario.nombre}] inició sesión correctamente en el sistema central.`;
        registrarBitacora(usuario.id_usuario, "LOGIN", usuario.nombre, detallesLogin);

        // Envío de respuesta con la estructura exacta que tu App.js espera
        return res.status(200).send({
            success: true,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol,
                estado: usuario.estado
            }
        });
    });
});

// === CREAR USUARIO ===
router.post("/crear", (req, res) => {
    const { nombre, correo, clave, rol, fecha_creacion, estado, ejecutado_por } = req.body;
    const operador = ejecutado_por || "DESCONOCIDO"; 

    db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error interno del servidor");
        }

        if (result.length > 0) {
            return res.status(400).send({ message: "El correo electrónico ya se encuentra registrado" });
        }

        db.query(
            'INSERT INTO usuarios(nombre, correo, clave, rol, fecha_creacion, estado) VALUES (?,?,?,?,?,?)',
            [nombre, correo, clave, rol, fecha_creacion, estado],
            (insertErr, insertResult) => {
                if (insertErr) {
                    console.error(insertErr);
                    return res.status(500).send("Error al registrar el usuario");
                } else {
                    const nuevoId = insertResult.insertId;
                    const detalles = `El usuario [${operador}] creó un nuevo perfil: ${nombre} con rol '${rol}'.`;
                    
                    registrarBitacora(nuevoId, "INSERCION", operador, detalles);
                    res.status(200).send("Usuario registrado con éxito!!!");
                }
            }
        );
    });
});

// === LISTAR USUARIOS ===
router.get("/", (req, res) => {
    const sqlQuery = `
        SELECT u.*, b.fecha_movimiento, b.tipo_movimiento, b.ejecutado_por, b.detalles
        FROM usuarios u
        LEFT JOIN (
            SELECT b1.*
            FROM bitacora b1
            INNER JOIN (
                SELECT id_usuario, MAX(fecha_movimiento) AS max_fecha
                FROM bitacora
                GROUP BY id_usuario
            ) b2 ON b1.id_usuario = b2.id_usuario AND b1.fecha_movimiento = b2.max_fecha
        ) b ON u.id_usuario = b.id_usuario
    `;

    db.query(sqlQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al obtener usuarios con auditoría");
        } else {
            res.send(result); 
        }
    });
});

// === ACTUALIZAR USUARIO ===
router.put("/actualizar", (req, res) => {
    const { id_usuario, nombre, correo, clave, rol, fecha_creacion, estado, ejecutado_por } = req.body;
    const operador = ejecutado_por || "DESCONOCIDO";
    const fechaFinal = fecha_creacion ? fecha_creacion.split('T')[0] : new Date().toISOString().split('T')[0];

    db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id_usuario], (searchErr, searchResult) => {
        if (searchErr || searchResult.length === 0) {
            return res.status(500).send("Error al buscar el usuario para actualizar");
        }

        const ant = searchResult[0];

        db.query(
            'UPDATE usuarios SET nombre=?, correo=?, clave=?, rol=?, fecha_creacion=?, estado=? WHERE id_usuario=?',
            [nombre, correo, clave, rol, fechaFinal, estado, id_usuario],
            (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send("Error al actualizar");
                } else {
                    let cambios = [];
                    if (ant.nombre !== nombre) cambios.push(`Nombre: '${ant.nombre}' -> '${nombre}'`);
                    if (ant.correo !== correo) cambios.push(`Correo: '${ant.correo}' -> '${correo}'`);
                    if (ant.rol !== rol) cambios.push(`Rol: '${ant.rol}' -> '${rol}'`);
                    if (ant.estado !== estado) cambios.push(`Estado: '${ant.estado}' -> '${estado}'`);
                    
                    const detalles = cambios.length > 0 
                        ? `Modificado por [${operador}]. Cambios: ${changes.join(', ')}` 
                        : `Actualizado por [${operador}] sin cambios estructurales.`;

                    registrarBitacora(id_usuario, "ACTUALIZACION", operador, detalles);
                    res.status(200).send("Usuario actualizado correctamente");
                }
            }
        );
    });
});

// === ELIMINAR USUARIO (Estructura tolerante a claves foráneas) ===
router.delete("/delete/:id_usuario", (req, res) => {
    const { id_usuario } = req.params; 
    const operador = req.query.operador || "DESCONOCIDO"; 
    const rolOperador = req.query.rolOperador ? req.query.rolOperador.trim().toLowerCase() : "";

    if (rolOperador === "sub coordinador municipal") {
        console.warn(`⚠️ ALERTA DE SEGURIDAD: El operador [${operador}] intentó borrar el ID ${id_usuario} sin permisos.`);
        return res.status(403).send("Acceso denegado: Tu rango de Sub-Coordinador Municipal no tiene autorización para destruir registros.");
    }

    db.query('SELECT nombre, correo, rol FROM usuarios WHERE id_usuario = ?', [id_usuario], (searchErr, searchResult) => {
        if (searchErr || searchResult.length === 0) {
            return res.status(500).send("El usuario no existe o ya fue eliminado");
        }
        
        const usuarioEliminado = searchResult[0];
        const detalles = `El operador [${operador}] eliminó de forma física al usuario: ${usuarioEliminado.nombre} con Rol: [${usuarioEliminado.rol}].`;

        registrarBitacora(id_usuario, "ELIMINACION", operador, detalles, (bitacoraErr) => {
            
            db.query('DELETE FROM usuarios WHERE id_usuario=?', [id_usuario], (deleteErr, result) => {
                if (deleteErr) {
                    console.error("❌ Error al remover de la tabla usuarios:", deleteErr);
                    return res.status(500).send("Error al eliminar el registro central");
                }
                
                return res.status(200).send("Usuario eliminado correctamente de la plataforma"); 
            });
        });
    });
});

module.exports = router;