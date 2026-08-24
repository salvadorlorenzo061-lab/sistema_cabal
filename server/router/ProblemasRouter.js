const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 
const { listarMunicipios, obtenerMunicipioPorId } = require('../catalogosTerritoriales');

db.query(`
    CREATE TABLE IF NOT EXISTS reporteria_flujo (
        modulo VARCHAR(40) NOT NULL,
        id_registro INT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
        observacion TEXT DEFAULT NULL,
        asignado_a INT DEFAULT NULL,
        asignado_por INT DEFAULT NULL,
        fecha_asignacion DATETIME DEFAULT NULL,
        finalizado_por INT DEFAULT NULL,
        fecha_finalizacion DATETIME DEFAULT NULL,
        fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (modulo, id_registro)
    )
`, (flujoErr) => {
    if (flujoErr) console.error('Error preparando flujo de reportería:', flujoErr);
});

db.query('ALTER TABLE problemas ADD COLUMN id_usuario INT DEFAULT NULL', (columnErr) => {
    if (columnErr && columnErr.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error preparando propietario de problemas:', columnErr);
        return;
    }

    db.query(`
        UPDATE problemas p
        LEFT JOIN afiliados a ON a.id_afiliado = p.id_afiliado
        SET p.id_usuario = a.id_usuario
        WHERE p.id_usuario IS NULL AND a.id_usuario IS NOT NULL
    `, (backfillErr) => {
        if (backfillErr) console.error('Error completando propietarios de problemas:', backfillErr);
    });
});

let problemasTieneFoto = null;

const resolverColumnaFoto = (callback) => {
    if (problemasTieneFoto !== null) {
        return callback(problemasTieneFoto);
    }

    db.query("SHOW COLUMNS FROM problemas LIKE 'foto'", (err, result) => {
        if (err) {
            console.error("No se pudo validar columna foto en problemas:", err);
            problemasTieneFoto = false;
            return callback(false);
        }

        problemasTieneFoto = Array.isArray(result) && result.length > 0;
        return callback(problemasTieneFoto);
    });
};

// === OBTENER CATÁLOGO DE MUNICIPIOS (AUXILIAR PARA SELECTORS) ===
router.get("/municipios", (req, res) => {
    return res.send(listarMunicipios());
});

router.get("/usuarios-asignables", (req, res) => {
    const idUsuario = Number(req.query.id_usuario || 0);
    if (!idUsuario) return res.status(401).json({ message: "Sesión no identificada." });

    db.query(
        "SELECT id_usuario, nombre, rol FROM usuarios WHERE LOWER(estado)='activo' ORDER BY nombre ASC",
        (err, result) => {
            if (err) {
                console.error("Error obteniendo usuarios asignables:", err);
                return res.status(500).json({ message: "No se pudo cargar la lista de encargados." });
            }
            return res.json(result);
        }
    );
});

// === OBTENER CATÁLOGO DE COCODES (AUXILIAR PARA TICKETS) ===
router.get("/cocodes", (req, res) => {
    const idUsuario = parseInt(req.query.id_usuario || '0', 10);
    const rol = String(req.query.rol || '').trim().toLowerCase();
    const puedeVerTodos = rol === 'admin' || rol === 'administrador' || rol === 'supervisor general';
    const whereSQL = puedeVerTodos ? '' : 'WHERE id_usuario = ?';
    const params = puedeVerTodos ? [] : [idUsuario];

    db.query(
        `SELECT id_afiliado AS id_cocode, id_afiliado, dpi, nombre_completo FROM afiliados ${whereSQL} ORDER BY nombre_completo ASC`,
        params,
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error al obtener el catálogo de cocodes");
            }
            return res.send(result);
        }
    );
});

// === CREAR INCIDENCIAS / PROBLEMAS (CON BITÁCORA) ===
router.post("/crear", (req, res) => {
    const {
        titulo,
        descripcion,
        barrio_colonia,
        id_municipio,
        estado,
        id_cocode,
        id_afiliado,
        foto,
        asignado_a,
        id_usuario_operador,
        nombre_usuario_operador
    } = req.body;

    const cocodeId = id_cocode || id_afiliado;
    const fecha_reporte = new Date(); // Captura temporal del servidor

    resolverColumnaFoto((tieneFoto) => {
        const sqlInsert = tieneFoto
            ? 'INSERT INTO problemas(titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, id_afiliado, id_usuario, foto) VALUES (?,?,?,?,?,?,?,?,?)'
            : 'INSERT INTO problemas(titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, id_afiliado, id_usuario) VALUES (?,?,?,?,?,?,?,?)';

        const paramsInsert = tieneFoto
            ? [titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, cocodeId, id_usuario_operador || null, foto || null]
            : [titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, cocodeId, id_usuario_operador || null];

        db.query(sqlInsert, paramsInsert, (insertErr, insertResult) => {
            if (insertErr) {
                console.error(insertErr);
                return res.status(500).send("Error al registrar la incidencia en el sistema");
            }

            // Consulta descriptiva para enriquecer la bitácora de auditoría
            const muniNombre = obtenerMunicipioPorId(id_municipio)?.nombre_municipio || `ID: ${id_municipio}`;
            const nuevoId = insertResult.insertId;
            const detalles = `Se reportó la incidencia '${titulo.toUpperCase()}' en el barrio/colonia '${barrio_colonia.toUpperCase()}', ${muniNombre.toUpperCase()}. Registrado con estado inicial '${estado.toUpperCase()}' por COCODE ID #${cocodeId} (Ticket: TCK-${new Date().getFullYear()}-${String(nuevoId).padStart(6, '0')}).`;

            const sqlBitacora = `
                INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                VALUES (?, 'INSERCION', ?, ?)
            `;

            const finalizarCreacion = () => {
                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    return res.status(200).json({ message: "Problema de la comunidad registrado con éxito", id_problema: nuevoId });
                });
            };

            if (!asignado_a) return finalizarCreacion();

            db.query(`
                INSERT INTO reporteria_flujo (modulo, id_registro, estado, asignado_a, asignado_por, fecha_asignacion)
                VALUES ('problemas', ?, 'Pendiente', ?, ?, NOW())
                ON DUPLICATE KEY UPDATE asignado_a=VALUES(asignado_a), asignado_por=VALUES(asignado_por), fecha_asignacion=NOW()
            `, [nuevoId, Number(asignado_a), id_usuario_operador || null], (asignacionErr) => {
                if (asignacionErr) {
                    console.error("Error asignando ticket recién creado:", asignacionErr);
                    return res.status(500).json({ message: "El problema se creó, pero no se pudo asignar al encargado." });
                }
                return finalizarCreacion();
            });
        });
    });
});

// === LISTAR PROBLEMAS (CON INNER JOIN PARA TRAER EL NOMBRE DEL MUNICIPIO) ===
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;
    const idUsuario = parseInt(req.query.id_usuario || '0', 10);
    const rol = String(req.query.rol || '').trim().toLowerCase();
    const puedeVerTodos = rol === 'admin' || rol === 'administrador' || rol === 'supervisor general';

    if (!puedeVerTodos && !idUsuario) {
        return res.status(400).json({ message: "No se pudo identificar al usuario de la sesión." });
    }

    const filtroPropietario = puedeVerTodos ? '' : 'WHERE p.id_usuario = ?';
    const paramsPropietario = puedeVerTodos ? [] : [idUsuario];

    resolverColumnaFoto((tieneFoto) => {
        const campoFoto = tieneFoto ? "p.foto" : "NULL AS foto";

        const sqlQuery = `
            SELECT
                p.id_problema,
                CONCAT('TCK-', DATE_FORMAT(p.fecha_reporte, '%Y'), '-', LPAD(p.id_problema, 6, '0')) AS ticket_codigo,
                p.titulo,
                p.descripcion,
                p.barrio_colonia,
                p.id_municipio,
                p.estado,
                p.fecha_reporte,
                p.id_afiliado,
                p.id_usuario,
                rf.asignado_a,
                ua.nombre AS nombre_asignado,
                p.id_afiliado AS id_cocode,
                ${campoFoto},
                m.nombre_municipio,
                a.nombre_completo AS nombre_cocode,
                a.dpi AS dpi_cocode
            FROM problemas p
            LEFT JOIN municipios m ON p.id_municipio = m.id_municipio
            LEFT JOIN afiliados a ON p.id_afiliado = a.id_afiliado
            LEFT JOIN reporteria_flujo rf ON rf.modulo='problemas' AND rf.id_registro=p.id_problema
            LEFT JOIN usuarios ua ON ua.id_usuario=rf.asignado_a
            ${filtroPropietario}
            ORDER BY p.fecha_reporte DESC
            LIMIT ? OFFSET ?
        `;

        db.query(`SELECT COUNT(*) AS total FROM problemas p ${filtroPropietario}`, paramsPropietario, (countErr, countResult) => {
            if (countErr) {
                console.error(countErr);
                return res.status(500).send("Error al obtener el listado de problemas");
            }

            db.query(sqlQuery, [...paramsPropietario, limite, offset], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send("Error al obtener el listado de problemas");
                } else {
                    const data = result.map((row) => ({
                        ...row,
                        nombre_municipio: row.nombre_municipio || obtenerMunicipioPorId(row.id_municipio)?.nombre_municipio || 'No asignado'
                    }));

                    res.send({
                        data,
                        total: countResult[0].total,
                        paginasTotales: Math.ceil(countResult[0].total / limite),
                        paginaActual: pagina
                    }); 
                }
            });
        });
    });
});

// === ACTUALIZAR PROBLEMA (CON ANÁLISIS HISTÓRICO DE CAMBIOS) ===
router.put("/actualizar", (req, res) => {
    const {
        id_problema,
        titulo,
        descripcion,
        barrio_colonia,
        id_municipio,
        estado,
        id_cocode,
        id_afiliado,
        foto,
        asignado_a,
        id_usuario_operador,
        nombre_usuario_operador
    } = req.body;

    const cocodeId = id_cocode || id_afiliado;
    
    // 1. Consultar estado histórico antes del UPDATE
    const sqlSelectOld = `SELECT * FROM problemas WHERE id_problema = ?`;

    db.query(sqlSelectOld, [id_problema], (errOld, resultOld) => {
        if (errOld || resultOld.length === 0) {
            console.error(errOld);
            return res.status(500).send("Error al verificar el registro previo de la incidencia");
        }

        const registroViejo = resultOld[0];

        // 2. Ejecutar la actualización en la tabla problemas
        resolverColumnaFoto((tieneFoto) => {
            const sqlUpdate = tieneFoto
                ? 'UPDATE problemas SET titulo=?, descripcion=?, barrio_colonia=?, id_municipio=?, estado=?, id_afiliado=?, foto=? WHERE id_problema=?'
                : 'UPDATE problemas SET titulo=?, descripcion=?, barrio_colonia=?, id_municipio=?, estado=?, id_afiliado=? WHERE id_problema=?';

            const paramsUpdate = tieneFoto
                ? [titulo, descripcion, barrio_colonia, id_municipio, estado, cocodeId, foto || null, id_problema]
                : [titulo, descripcion, barrio_colonia, id_municipio, estado, cocodeId, id_problema];

                db.query(sqlUpdate, paramsUpdate, (updateErr, updateResult) => {
                if (updateErr) {
                    console.error(updateErr);
                    return res.status(500).send("Error al actualizar la incidencia");
                }

                // 3. Evaluar qué campos cambiaron exactamente para la Bitácora
                let cambios = [];
                if (registroViejo.titulo !== titulo) cambios.push(`Título: '${registroViejo.titulo}' -> '${titulo.toUpperCase()}'`);
                if (registroViejo.estado !== estado) cambios.push(`Estado: '${registroViejo.estado}' -> '${estado.toUpperCase()}'`);
                if (registroViejo.barrio_colonia !== barrio_colonia) cambios.push(`Barrio/Colonia: '${registroViejo.barrio_colonia}' -> '${barrio_colonia.toUpperCase()}'`);
                if (registroViejo.id_municipio !== parseInt(id_municipio, 10)) cambios.push(`Muni ID: '${registroViejo.id_municipio}' -> '${id_municipio}'`);
                if (registroViejo.id_afiliado !== parseInt(cocodeId, 10)) cambios.push(`COCODE ID: '${registroViejo.id_afiliado}' -> '${cocodeId}'`);

                const detallesString = cambios.length > 0 
                    ? `Modificado por ${nombre_usuario_operador}. Cambios en problema ID #${id_problema}: ${cambios.join(', ')}`
                    : `Se guardó la incidencia ID #${id_problema} sin efectuar variaciones en sus campos primarios.`;

                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'ACTUALIZACION', ?, ?)
                `;

                const finalizarActualizacion = () => {
                    db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detallesString], (bitacoraErr) => {
                        if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                        return res.status(200).send("Incidencia actualizada correctamente");
                    });
                };

                if (!asignado_a) return finalizarActualizacion();

                db.query(`
                    INSERT INTO reporteria_flujo (modulo, id_registro, estado, asignado_a, asignado_por, fecha_asignacion)
                    VALUES ('problemas', ?, 'Pendiente', ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE asignado_a=VALUES(asignado_a), asignado_por=VALUES(asignado_por), fecha_asignacion=NOW()
                `, [id_problema, Number(asignado_a), id_usuario_operador || null], (asignacionErr) => {
                    if (asignacionErr) {
                        console.error("Error actualizando encargado del ticket:", asignacionErr);
                        return res.status(500).send("La incidencia se actualizó, pero no se pudo cambiar el encargado");
                    }
                    return finalizarActualizacion();
                });
            });
        });
    });
});

// === ELIMINAR PROBLEMA (CON LOG DE BITÁCORA) ===
router.delete("/delete/:id_problema", (req, res) => {
    const { id_problema } = req.params; 
    const { id_usuario_operador, nombre_usuario_operador } = req.query;

    db.query('SELECT titulo, barrio_colonia FROM problemas WHERE id_problema = ?', [id_problema], (errFind, resultFind) => {
        if (errFind || resultFind.length === 0) {
            return res.status(500).send("No se localizó la incidencia a remover");
        }

        const problema = resultFind[0];
        const detalles = `Se eliminó el reporte de problema '${problema.titulo.toUpperCase()}' ubicado en '${problema.barrio_colonia.toUpperCase()}' (ID previo removido: #${id_problema}).`;

        db.query('DELETE FROM problemas WHERE id_problema=?', [id_problema], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error al eliminar el registro de la tabla problemas");
            }

            const sqlBitacora = `
                INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                VALUES (?, 'ELIMINACION', ?, ?)
            `;

            db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                return res.status(200).send("Problema eliminado del registro de auditoría"); 
            });
        });
    });
});

module.exports = router;
