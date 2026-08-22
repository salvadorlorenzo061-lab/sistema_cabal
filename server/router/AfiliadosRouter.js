const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 
const { obtenerMunicipioPorId } = require('../catalogosTerritoriales');

db.query('ALTER TABLE afiliados ADD COLUMN numero_celular VARCHAR(25) DEFAULT NULL AFTER telefono', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error agregando numero_celular a afiliados:', err);
    }
});

db.query('ALTER TABLE afiliados ADD COLUMN id_creador INT DEFAULT NULL AFTER id_usuario', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error agregando creador a afiliados:', err);
        return;
    }

    db.query('UPDATE afiliados SET id_creador=id_usuario WHERE id_creador IS NULL', (backfillErr) => {
        if (backfillErr) console.error('Error completando creadores de afiliados:', backfillErr);
    });
});

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

// === 1. LISTAR COCODES ===
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;
    const idUsuario = parseInt(req.query.id_usuario || '0', 10);
    const rol = String(req.query.rol || '').trim().toLowerCase();
    const puedeVerTodos = rol === 'administrador' || rol === 'supervisor general';

    if (!puedeVerTodos && !idUsuario) {
        return res.status(400).json({ message: "No se pudo identificar al usuario de la sesión." });
    }

    const filtroPropietario = puedeVerTodos ? '' : 'WHERE a.id_usuario = ?';
    const paramsPropietario = puedeVerTodos ? [] : [idUsuario];

    const sqlQuery = `
        SELECT a.*, m.nombre_municipio, u.nombre AS nombre_usuario
        FROM afiliados a
        LEFT JOIN municipios m ON a.id_municipio = m.id_municipio
        LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
        ${filtroPropietario}
        ORDER BY a.id_afiliado DESC
        LIMIT ? OFFSET ?
    `;

    db.query(`SELECT COUNT(*) AS total FROM afiliados a ${filtroPropietario}`, paramsPropietario, (countErr, countResult) => {
        if (countErr) {
            console.error("Error MySQL en count cocodes:", countErr);
            return res.status(500).json({ message: "Error al obtener el listado de cocodes." });
        }

        db.query(sqlQuery, [...paramsPropietario, limite, offset], (err, result) => {
            if (err) {
                console.error("Error MySQL en GET /:", err);
                return res.status(500).json({ message: "Error al obtener el listado de cocodes." });
            } else {
                const data = result.map((row) => ({
                    ...row,
                    nombre_municipio: row.nombre_municipio || obtenerMunicipioPorId(row.id_municipio)?.nombre_municipio || 'No asignado'
                }));

                return res.send({
                    data,
                    total: countResult[0].total,
                    paginasTotales: Math.ceil(countResult[0].total / limite),
                    paginaActual: pagina
                }); 
            }
        });
    });
});

// === 2. CREAR COCODE ===
router.post("/crear", (req, res) => {
    const { 
        dpi, lugar_votacion, nombre_completo, 
        telefono, numero_celular, direccion, barrio_colonia, id_municipio,
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
                message: `El cocode con DPI '${dpi}' no se puede crear porque ya está registrado. Fue ingresado por el usuario/coordinador: ${registradoPor}.` 
            });
        }

        // Inserción del nuevo cocode
        const sqlInsert = `
            INSERT INTO afiliados (dpi, lugar_votacion, nombre_completo, telefono, numero_celular, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, id_creador, foto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sqlInsert,
            [dpi, lugar_votacion, nombre_completo, telefono, numero_celular || null, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, operador_id || id_usuario || null, foto || null],
            (insertErr) => {
                if (insertErr) {
                    console.error("Error MySQL en /crear:", insertErr);
                    return res.status(500).json({ message: "Error interno al registrar el cocode en la base de datos." });
                }

                // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
                const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] afilió exitosamente a: ${nombre_completo.toUpperCase()} con DPI: ${dpi}.`;
                registrarAccionBitacora(operador_id, nombre_completo, "ALTA_AFILIADO", operador_nombre, detalles);

                return res.status(200).send("Cocode registrado con éxito");
            }
        );
    });
});

// === 3. ACTUALIZAR COCODE ===
router.put("/actualizar", (req, res) => {
    const { 
        id_afiliado, dpi, lugar_votacion, nombre_completo, 
        telefono, numero_celular, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto,
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
                message: `No se puede actualizar. El número de DPI '${dpi}' ya le pertenece a otro cocode, el cual fue ingresado por: ${registradoPor}.` 
            });
        }

        // Respaldo de los datos anteriores para la auditoría de cambios
        db.query("SELECT nombre_completo, dpi FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (errOld, rowsOld) => {
            if (errOld || rowsOld.length === 0) return res.status(404).json({ message: "Cocode no encontrado." });
            const viejo = rowsOld[0];

            const sqlUpdate = `
                UPDATE afiliados 
                SET dpi=?, lugar_votacion=?, nombre_completo=?, telefono=?, numero_celular=?, direccion=?, barrio_colonia=?, id_municipio=?, fecha_afiliacion=?, id_usuario=?, foto=?
                WHERE id_afiliado=?
            `;
            db.query(sqlUpdate, [dpi, lugar_votacion, nombre_completo, telefono, numero_celular || null, direccion, barrio_colonia, id_municipio, fecha_afiliacion, id_usuario, foto || null, id_afiliado], (upErr) => {
                if (upErr) {
                    console.error("Error al actualizar:", upErr);
                    return res.status(500).json({ message: "Error interno al guardar los cambios del cocode." });
                }

                // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
                const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] actualizó al cocode ID #${id_afiliado}. Datos anteriores -> Nombre: '${viejo.nombre_completo}', DPI: '${viejo.dpi}'. Datos nuevos -> Nombre: '${nombre_completo}', DPI: '${dpi}'.`;
                registrarAccionBitacora(operador_id, nombre_completo, "CAMBIO_AFILIADO", operador_nombre, detalles);

                return res.status(200).send("Cocode actualizado con éxito");
            });
        });
    });
});

// === 4. ELIMINAR COCODE ===
router.delete("/delete/:id_afiliado", (req, res) => {
    const { id_afiliado } = req.params;
    const { operador_id, operador_nombre, operador_rol } = req.query;

    db.query("SELECT nombre_completo, dpi FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (err, rows) => {
        if (err || rows.length === 0) {
            return res.status(404).json({ message: "El cocode no existe en la base de datos." });
        }
        const afiliadoNombre = rows[0].nombre_completo;
        const afiliadoDpi = rows[0].dpi;

        db.query("DELETE FROM afiliados WHERE id_afiliado = ?", [id_afiliado], (delErr) => {
            if (delErr) {
                console.error("Error al eliminar cocode:", delErr);
                return res.status(500).json({ message: "No se pudo eliminar el cocode, puede tener registros dependientes." });
            }

            // 📝 GUARDAR EN BITÁCORA TRAS ÉXITO
            const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] eliminó permanentemente del sistema al cocode: ${afiliadoNombre.toUpperCase()} (DPI: ${afiliadoDpi}, ID: #${id_afiliado}).`;
            registrarAccionBitacora(operador_id, afiliadoNombre, "BAJA_AFILIADO", operador_nombre, detalles);

            return res.status(200).send("Cocode removido con éxito");
        });
    });
});

module.exports = router;
