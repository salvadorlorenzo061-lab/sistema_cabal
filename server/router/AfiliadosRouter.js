const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

/**
 * 🛡️ FUNCIÓN DE AUDITORÍA INTERNA (Bitácora)
 * Inserta de manera automática las trazas de movimientos en la base de datos.
 */
const registrarAccionBitacora = (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles) => {
    const sqlBitacora = `
        INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;
    db.query(sqlBitacora, [id_usuario || 1, usuario_afectado, tipo_movimiento, ejecutado_por || "SISTEMA", detalles], (err) => {
        if (err) {
            console.error("❌ Error interno al registrar en la bitácora de auditoría:", err);
        }
    });
};

// === 1. LISTAR AFILIADOS ===
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;

    const sqlQuery = `
        SELECT a.*, m.nombre_municipio, u.nombre AS nombre_usuario
        FROM afiliados a
        LEFT JOIN municipios m ON a.id_municipio = m.id_municipio
        LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
        ORDER BY a.id_afiliado DESC
        LIMIT ? OFFSET ?
    `;

    db.query('SELECT COUNT(*) AS total FROM afiliados', (countErr, countResult) => {
        if (countErr) {
            console.error("Error MySQL en count afiliados:", countErr);
            return res.status(500).json({ message: "Error al obtener el listado de afiliados." });
        }

        db.query(sqlQuery, [limite, offset], (err, result) => {
            if (err) {
                console.error("Error MySQL en GET /:", err);
                return res.status(500).json({ message: "Error al obtener el listado de afiliados." });
            } else {
                return res.send({
                    data: result,
                    total: countResult[0].total,
                    paginasTotales: Math.ceil(countResult[0].total / limite),
                    paginaActual: pagina
                }); 
            }
        });
    });
});

// === 2. CREAR AFILIADO ===
router.post("/crear", (req, res) => {
    const { 
        dpi, num_empadronamiento, lugar_votacion, nombre_completo, 
        telefono, direccion, barrio_colonia, id_municipio, 
        fecha_afiliacion, id_usuario, foto, 
        operador_id, operador_nombre, operador_rol 
    } = req.body;

    // Validación de duplicado de DPI
    const sqlCheckDpi = `
        SELECT a.dpi, u.nombre AS nombre_coordinador 
        FROM afiliados a
        LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE a.dpi = ?
    `;

    db.query(sqlCheckDpi, [dpi], (err, rowsDpi) => {
        if (err) {
            console.error("Error al verificar DPI:", err);
            return res.status(500).json({ message: "Error interno al verificar el documento de identidad (DPI)." });
        }

        if (rowsDpi.length > 0) {
            const registradoPor = rowsDpi[0].nombre_coordinador || "un usuario del sistema";
            return res.status(400).json({ 
                message: `El afiliado con DPI '${dpi}' no se puede crear porque ya está registrado. Fue ingresado por el usuario/coordinador: ${registradoPor}.` 
            });
        }

        // Validación de duplicado de Número de Empadronamiento
        const sqlCheckPadron = `
            SELECT a.num_empadronamiento, u.nombre AS nombre_coordinador 
            FROM afiliados a
            LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
            WHERE a.num_empadronamiento = ?
        `;

        db.query(sqlCheckPadron, [num_empadronamiento], (errPadron, rowsPadron) => {
            if (errPadron) {
                console.error("Error al verificar Empadronamiento:", errPadron);
                return res.status(500).json({ message: "Error interno al verificar el número de empadronamiento." });
            }

            if (rowsPadron.length > 0) {
                const registradoPorPadron = rowsPadron[0].nombre_coordinador || "un usuario del sistema";
                return res.status(400).json({ 
                    message: `El Número de Empadronamiento '${num_empadronamiento}' ya se encuentra registrado en el sistema. Fue ingresado por el usuario/coordinador: ${registradoPorPadron}.` 
                });
            }

            // Inserción del nuevo afiliado
            const sqlInsert = `
                INSERT INTO afiliados (dpi, num_empadronamiento, lugar_votacion, nombre_completo, telefono, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sqlInsert,
                [dpi, num_empadronamiento, lugar_votacion, nombre_completo, telefono, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto || null],
                (insertErr, insertResult) => {
                    if (insertErr) {
                        console.error("Error MySQL en /crear:", insertErr);
                        return res.status(500).json({ message: "Error interno al registrar el afiliado en la base de datos." });
                    }

                    // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
                    const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] afilió exitosamente a: ${nombre_completo.toUpperCase()} con DPI: ${dpi} y Padrón: ${num_empadronamiento}.`;
                    registrarAccionBitacora(operador_id, nombre_completo, "ALTA_AFILIADO", operador_nombre, detalles);

                    return res.status(200).send("Afiliado registrado con éxito");
                }
            );
        });
    });
});

// === 3. ACTUALIZAR AFILIADO ===
router.put("/actualizar", (req, res) => {
    const { 
        id_afiliado, dpi, num_empadronamiento, lugar_votacion, nombre_completo, 
        telefono, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto, 
        operador_id, operador_nombre, operador_rol 
    } = req.body;
    
    const sqlCheckDpiUpdate = `
        SELECT a.id_afiliado, u.nombre AS nombre_coordinador 
        FROM afiliados a
        LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE a.dpi = ? AND a.id_afiliado != ?
    `;

    db.query(sqlCheckDpiUpdate, [dpi, id_afiliado], (err, rowsDpi) => {
        if (err) {
            console.error("Error al verificar DPI en actualización:", err);
            return res.status(500).json({ message: "Error interno al validar el documento de identidad." });
        }

        if (rowsDpi.length > 0) {
            const registradoPor = rowsDpi[0].nombre_coordinador || "un usuario del sistema";
            return res.status(400).json({ 
                message: `No se puede actualizar. El número de DPI '${dpi}' ya le pertenece a otro afiliado, el cual fue ingresado por: ${registradoPor}.` 
            });
        }

        const sqlCheckPadronUpdate = `
            SELECT a.id_afiliado, u.nombre AS nombre_coordinador 
            FROM afiliados a
            LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
            WHERE a.num_empadronamiento = ? AND a.id_afiliado != ?
        `;

        db.query(sqlCheckPadronUpdate, [num_empadronamiento, id_afiliado], (errPadron, rowsPadron) => {
            if (errPadron) {
                console.error("Error al verificar padrón en actualización:", errPadron);
                return res.status(500).json({ message: "Error interno al validar el número de empadronamiento." });
            }

            if (rowsPadron.length > 0) {
                const registradoPorPadron = rowsPadron[0].nombre_coordinador || "un usuario del sistema";
                return res.status(400).json({ 
                    message: `No se puede actualizar. El número de padrón '${num_empadronamiento}' ya le pertenece a otro afiliado, el cual fue ingresado por: ${registradoPorPadron}.` 
                });
            }

            // Respaldo de los datos anteriores para la auditoría de cambios
            db.query("SELECT nombre_completo, dpi, num_empadronamiento FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (errOld, rowsOld) => {
                if (errOld || rowsOld.length === 0) return res.status(404).json({ message: "Afiliado no encontrado." });
                const viejo = rowsOld[0];

                const sqlUpdate = `
                    UPDATE afiliados 
                    SET dpi=?, num_empadronamiento=?, lugar_votacion=?, nombre_completo=?, telefono=?, direccion=?, barrio_colonia=?, id_municipio=?, fecha_afiliacion=?, id_usuario=?, foto=? 
                    WHERE id_afiliado=?
                `;
                db.query(sqlUpdate, [dpi, num_empadronamiento, lugar_votacion, nombre_completo, telefono, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto || null, id_afiliado], (upErr) => {
                    if (upErr) {
                        console.error("Error al actualizar:", upErr);
                        return res.status(500).json({ message: "Error interno al guardar los cambios del afiliado." });
                    }

                    // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
                    const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] actualizó al afiliado ID #${id_afiliado}. Datos anteriores -> Nombre: '${viejo.nombre_completo}', DPI: '${viejo.dpi}', Padrón: '${viejo.num_empadronamiento}'. Datos nuevos -> Nombre: '${nombre_completo}', DPI: '${dpi}', Padrón: '${num_empadronamiento}'.`;
                    registrarAccionBitacora(operador_id, nombre_completo, "CAMBIO_AFILIADO", operador_nombre, detalles);

                    return res.status(200).send("Afiliado actualizado con éxito");
                });
            });
        });
    });
});

// === 4. ELIMINAR AFILIADO ===
router.delete("/delete/:id_afiliado", (req, res) => {
    const { id_afiliado } = req.params;
    const { operador_id, operador_nombre, operador_rol } = req.query;

    db.query("SELECT nombre_completo, dpi FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (err, rows) => {
        if (err || rows.length === 0) {
            return res.status(404).json({ message: "El afiliado no existe en la base de datos." });
        }
        const afiliadoNombre = rows[0].nombre_completo;
        const afiliadoDpi = rows[0].dpi;

        db.query("DELETE FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (delErr) => {
            if (delErr) {
                console.error("Error al eliminar afiliado:", delErr);
                return res.status(500).json({ message: "No se pudo eliminar el afiliado, puede tener registros dependientes." });
            }

            // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
            const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] eliminó permanentemente del sistema al afiliado: ${afiliadoNombre.toUpperCase()} (DPI: ${afiliadoDpi}, ID: #${id_afiliado}).`;
            registrarAccionBitacora(operador_id, afiliadoNombre, "BAJA_AFILIADO", operador_nombre, detalles);

            return res.status(200).send("Afiliado removido con éxito");
        });
    });
});

module.exports = router;