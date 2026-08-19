const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

db.query('ALTER TABLE usuarios ADD COLUMN numero_celular VARCHAR(25) DEFAULT NULL AFTER correo', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error agregando numero_celular a usuarios:', err);
    }
});

// === 🛡️ FUNCIÓN AUXILIAR PARA REGISTRAR EN BITÁCORA (Sincronizada con Aiven) ===
const registrarBitacora = (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, callback) => {
    // Agregada explícitamente la columna 'usuario_afectado' requerida en la BD
    const sqlBitacora = `
        INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    db.query(sqlBitacora, [id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles], (err, result) => {
        if (err) {
            console.error("❌ Error crítico al insertar en la bitácora de base de datos:", err.message);
            if (callback) callback(err);
        } else {
            console.log(`✅ Bitácora registrada con éxito: [${tipo_movimiento}] por [${ejecutado_por}]`);
            if (callback) callback(null, result);
        }
    });
};

// =========================================================================
// 🔐 ENDPOINT: INICIO DE SESIÓN (LOGIN)
// =========================================================================
router.post("/login", (req, res) => {
    try {
        const { correo, clave } = req.body;

        if (!correo || !clave) {
            return res.status(400).send({ error: "Por favor, ingrese el correo electrónico y la contraseña." });
        }

        const correoLimpio = correo.toLowerCase().trim();
        const claveLimpia = String(clave || '').trim();

        const responderLogin = (usuario) => {
            if (!usuario) {
                return res.status(401).send({ error: "El correo electrónico ingresado no existe." });
            }

            if (usuario.clave !== claveLimpia) {
                return res.status(401).send({ error: "La contraseña es incorrecta." });
            }

            if (usuario.estado && usuario.estado.trim().toLowerCase() !== 'activo') {
                return res.status(403).send({ error: "Este usuario se encuentra inactivo. Comuníquese con el Administrador." });
            }

            try {
                const detallesLogin = `El usuario [${usuario.nombre || 'Desconocido'}] inició sesión correctamente.`;
                registrarBitacora(
                    usuario.id_usuario,
                    usuario.nombre || "SISTEMA",
                    "LOGIN",
                    usuario.nombre || "SISTEMA",
                    detallesLogin
                );
            } catch (bitacoraError) {
                console.error("⚠️ Error no síncrono en bitácora de Login:", bitacoraError);
            }

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
        };

        db.query('SELECT * FROM usuarios WHERE LOWER(TRIM(correo)) = ?', [correoLimpio], (err, result) => {
            if (err) {
                console.error("❌ Error en la consulta SQL de Login:", err);
                return res.status(500).send({ error: "Error interno en la base de datos al buscar el usuario." });
            }

            if (!result || result.length === 0) {
                return responderLogin(null);
            }

            const usuario = result[0];
            const rolNombre = String(usuario.rol || '').trim();

            if (!rolNombre) {
                return responderLogin(usuario);
            }

            db.query('SELECT * FROM roles WHERE LOWER(TRIM(nombre_rol)) = LOWER(TRIM(?))', [rolNombre], (roleErr, roleRows) => {
                if (!roleErr && roleRows && roleRows.length > 0) {
                    const permisosRaw = roleRows[0].permisos;
                    const permisos = Array.isArray(permisosRaw)
                        ? permisosRaw
                        : (typeof permisosRaw === 'string' ? (() => { try { return JSON.parse(permisosRaw); } catch (_) { return []; } })() : []);
                    usuario.permisos = permisos;
                }
                return responderLogin(usuario);
            });
        });
    } catch (globalError) {
        console.error("❌ Error crítico global en el endpoint /login:", globalError);
        return res.status(500).send({ error: "Fallo crítico en el enrutador de login." });
    }
});

// === CREAR USUARIO ===
router.post("/crear", (req, res) => {
    const { nombre, correo, numero_celular, clave, rol, fecha_creacion, estado, ejecutado_por } = req.body;
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
            'INSERT INTO usuarios(nombre, correo, numero_celular, clave, rol, fecha_creacion, estado) VALUES (?,?,?,?,?,?,?)',
            [nombre, correo, numero_celular || null, clave, rol, fecha_creacion, estado],
            (insertErr, insertResult) => {
                if (insertErr) {
                    console.error(insertErr);
                    return res.status(500).send("Error al registrar el usuario");
                } else {
                    const nuevoId = insertResult.insertId;
                    const detalles = `El usuario [${operador}] creó un nuevo perfil: ${nombre} con rol '${rol}'.`;
                    
                    // Sincronizado enviando el campo 'nombre' como el usuario afectado
                    registrarBitacora(nuevoId, nombre, "INSERCION", operador, detalles);
                    res.status(200).send("Usuario registrado con éxito!!!");
                }
            }
        );
    });
});

// === LISTAR USUARIOS ===
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;

    const sqlQuery = `
        SELECT u.*, b.fecha_movimiento, b.tipo_movimiento, b.ejecutado_por, b.detalles, b.usuario_afectado
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
        ORDER BY u.id_usuario DESC
        LIMIT ? OFFSET ?
    `;

    db.query('SELECT COUNT(*) AS total FROM usuarios', (countErr, countResult) => {
        if (countErr) {
            console.error(countErr);
            return res.status(500).send("Error al obtener usuarios con auditoría");
        }

        db.query(sqlQuery, [limite, offset], (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send("Error al obtener usuarios con auditoría");
            } else {
                res.send({
                    data: result,
                    total: countResult[0].total,
                    paginasTotales: Math.ceil(countResult[0].total / limite),
                    paginaActual: pagina
                }); 
            }
        });
    });
});

// === ACTUALIZAR USUARIO ===
router.put("/actualizar", (req, res) => {
    const { id_usuario, nombre, correo, numero_celular, clave, rol, fecha_creacion, estado, ejecutado_por } = req.body;
    const operador = ejecutado_por || "DESCONOCIDO";
    const fechaFinal = fecha_creacion ? fecha_creacion.split('T')[0] : new Date().toISOString().split('T')[0];

    db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id_usuario], (searchErr, searchResult) => {
        if (searchErr || searchResult.length === 0) {
            return res.status(500).send("Error al buscar el usuario para actualizar");
        }

        const ant = searchResult[0];

        db.query(
            'UPDATE usuarios SET nombre=?, correo=?, numero_celular=?, clave=?, rol=?, fecha_creacion=?, estado=? WHERE id_usuario=?',
            [nombre, correo, numero_celular || null, clave, rol, fechaFinal, estado, id_usuario],
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
                        ? `Modificado por [${operador}]. Cambios: ${cambios.join(', ')}` 
                        : `Actualizado por [${operador}] sin cambios estructurales.`;

                    // Sincronizado enviando el nombre actual del usuario modificado
                    registrarBitacora(id_usuario, nombre, "ACTUALIZACION", operador, detalles);
                    res.status(200).send("Usuario actualizado correctamente");
                }
            }
        );
    });
});

// === ELIMINAR USUARIO ===
router.delete("/delete/:id_usuario", (req, res) => {
    const { id_usuario } = req.params; 
    const operador = req.query.operador || "DESCONOCIDO"; 

    db.query('SELECT nombre, correo, rol FROM usuarios WHERE id_usuario = ?', [id_usuario], (searchErr, searchResult) => {
        if (searchErr || searchResult.length === 0) {
            return res.status(500).send("El usuario no existe o ya fue eliminado");
        }
        
        const usuarioEliminado = searchResult[0];
        const detalles = `El operador [${operador}] eliminó de forma física al usuario: ${usuarioEliminado.nombre} con Rol: [${usuarioEliminado.rol}].`;

        // Sincronizado enviando el nombre del usuario que se va a eliminar
        registrarBitacora(id_usuario, usuarioEliminado.nombre, "ELIMINACION", operador, detalles, (bitacoraErr) => {
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