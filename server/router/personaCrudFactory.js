const express = require('express');
const db = require('../Conexion');

const registrarBitacora = (idUsuario, usuarioAfectado, tipoMovimiento, ejecutadoPor, detalles) => {
    const sql = `
        INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento)
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

    db.query(sql, [idUsuario || 1, usuarioAfectado, tipoMovimiento, ejecutadoPor || 'SISTEMA', detalles], (err) => {
        if (err) {
            console.error('Error al registrar bitacora:', err);
        }
    });
};

const crearRouterCrudPersona = ({
    tableName,
    idColumn,
    entityLabel,
    entityLabelPlural,
    auditPrefix
}) => {
    const router = express.Router();

    const crearTablaSiNoExiste = () => {
        const sql = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                ${idColumn} INT AUTO_INCREMENT PRIMARY KEY,
                dpi VARCHAR(30) NOT NULL,
                nombre VARCHAR(200) NOT NULL,
                direccion VARCHAR(255) DEFAULT NULL,
                telefono VARCHAR(30) DEFAULT NULL,
                id_usuario INT DEFAULT NULL,
                foto LONGTEXT DEFAULT NULL,
                observaciones TEXT DEFAULT NULL,
                estado ENUM('Activo', 'Desactivado') NOT NULL DEFAULT 'Activo',
                fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_${tableName}_dpi (dpi)
            )
        `;

        db.query(sql, (err) => {
            if (err) {
                console.error(`Error creando tabla ${tableName}:`, err);
                return;
            }

            db.query(`ALTER TABLE ${tableName} ADD COLUMN id_usuario INT DEFAULT NULL AFTER telefono`, (alterErr) => {
                if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error agregando propietario a ${tableName}:`, alterErr);
                }
            });
        });
    };

    crearTablaSiNoExiste();

    router.get('/', (req, res) => {
        const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
        const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
        const offset = (pagina - 1) * limite;
        const idUsuario = parseInt(req.query.id_usuario || '0', 10);
        const rol = String(req.query.rol || '').trim().toLowerCase();
        const puedeVerTodos = rol === 'admin' || rol === 'administrador' || rol === 'supervisor general';
        const whereSQL = puedeVerTodos ? '' : 'WHERE id_usuario = ?';
        const params = puedeVerTodos ? [] : [idUsuario];

        db.query(`SELECT COUNT(*) AS total FROM ${tableName} ${whereSQL}`, params, (countErr, countResult) => {
            if (countErr) {
                console.error(countErr);
                return res.status(500).json({ message: `Error al obtener ${entityLabelPlural}.` });
            }

            db.query(
                `SELECT * FROM ${tableName} ${whereSQL} ORDER BY ${idColumn} DESC LIMIT ? OFFSET ?`,
                [...params, limite, offset],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ message: `Error al obtener ${entityLabelPlural}.` });
                    }

                    return res.send({
                        data: result,
                        total: countResult[0].total,
                        paginasTotales: Math.ceil(countResult[0].total / limite),
                        paginaActual: pagina
                    });
                }
            );
        });
    });

    router.post('/crear', (req, res) => {
        const {
            dpi,
            nombre,
            direccion,
            telefono,
            foto,
            observaciones,
            estado,
            operador_id,
            operador_nombre,
            operador_rol
        } = req.body;

        if (!dpi?.trim() || !nombre?.trim()) {
            return res.status(400).json({ message: 'DPI y nombre son obligatorios.' });
        }

        db.query(`SELECT ${idColumn} FROM ${tableName} WHERE dpi = ?`, [dpi.trim()], (checkErr, rows) => {
            if (checkErr) {
                console.error(checkErr);
                return res.status(500).json({ message: `Error al validar el DPI del ${entityLabel}.` });
            }

            if (rows.length > 0) {
                return res.status(400).json({ message: `El DPI '${dpi.trim()}' ya existe en ${entityLabelPlural}.` });
            }

            const sqlInsert = `
                INSERT INTO ${tableName} (dpi, nombre, direccion, telefono, id_usuario, foto, observaciones, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sqlInsert,
                [
                    dpi.trim(),
                    nombre.trim(),
                    direccion?.trim() || null,
                    telefono?.trim() || null,
                    operador_id || null,
                    foto || null,
                    observaciones?.trim() || null,
                    estado || 'Activo'
                ],
                (insertErr) => {
                    if (insertErr) {
                        console.error(insertErr);
                        return res.status(500).json({ message: `No se pudo crear ${entityLabel}.` });
                    }

                    const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] registro ${auditPrefix} '${nombre.trim().toUpperCase()}' con DPI ${dpi.trim()}.`;
                    registrarBitacora(operador_id, nombre.trim(), `ALTA_${auditPrefix.toUpperCase()}`, operador_nombre, detalles);

                    return res.status(200).send(`${entityLabel} registrado con exito`);
                }
            );
        });
    });

    router.put('/actualizar', (req, res) => {
        const {
            [idColumn]: idRegistro,
            dpi,
            nombre,
            direccion,
            telefono,
            foto,
            observaciones,
            estado,
            operador_id,
            operador_nombre,
            operador_rol
        } = req.body;

        if (!idRegistro || !dpi?.trim() || !nombre?.trim()) {
            return res.status(400).json({ message: 'ID, DPI y nombre son obligatorios.' });
        }

        db.query(
            `SELECT ${idColumn}, nombre, dpi FROM ${tableName} WHERE dpi = ? AND ${idColumn} != ?`,
            [dpi.trim(), idRegistro],
            (checkErr, rows) => {
                if (checkErr) {
                    console.error(checkErr);
                    return res.status(500).json({ message: `Error al validar el DPI del ${entityLabel}.` });
                }

                if (rows.length > 0) {
                    return res.status(400).json({ message: `El DPI '${dpi.trim()}' ya pertenece a otro ${entityLabel}.` });
                }

                db.query(
                    `SELECT nombre, dpi FROM ${tableName} WHERE ${idColumn} = ?`,
                    [idRegistro],
                    (findErr, currentRows) => {
                        if (findErr || currentRows.length === 0) {
                            return res.status(404).json({ message: `${entityLabel} no encontrado.` });
                        }

                        const anterior = currentRows[0];
                        const sqlUpdate = `
                            UPDATE ${tableName}
                            SET dpi = ?, nombre = ?, direccion = ?, telefono = ?, foto = ?, observaciones = ?, estado = ?
                            WHERE ${idColumn} = ?
                        `;

                        db.query(
                            sqlUpdate,
                            [
                                dpi.trim(),
                                nombre.trim(),
                                direccion?.trim() || null,
                                telefono?.trim() || null,
                                foto || null,
                                observaciones?.trim() || null,
                                estado || 'Activo',
                                idRegistro
                            ],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error(updateErr);
                                    return res.status(500).json({ message: `No se pudo actualizar ${entityLabel}.` });
                                }

                                const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] actualizo ${auditPrefix} ID #${idRegistro}. Antes: ${anterior.nombre} / ${anterior.dpi}. Ahora: ${nombre.trim()} / ${dpi.trim()}.`;
                                registrarBitacora(operador_id, nombre.trim(), `CAMBIO_${auditPrefix.toUpperCase()}`, operador_nombre, detalles);

                                return res.status(200).send(`${entityLabel} actualizado con exito`);
                            }
                        );
                    }
                );
            }
        );
    });

    router.delete('/delete/:id', (req, res) => {
        const { id } = req.params;
        const { operador_id, operador_nombre, operador_rol } = req.query;

        db.query(
            `SELECT nombre, dpi FROM ${tableName} WHERE ${idColumn} = ?`,
            [id],
            (findErr, rows) => {
                if (findErr || rows.length === 0) {
                    return res.status(404).json({ message: `${entityLabel} no encontrado.` });
                }

                const actual = rows[0];
                db.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [id], (deleteErr) => {
                    if (deleteErr) {
                        console.error(deleteErr);
                        return res.status(500).json({ message: `No se pudo eliminar ${entityLabel}.` });
                    }

                    const detalles = `El ${operador_rol || 'Operador'} [${operador_nombre || 'Desconocido'}] elimino ${auditPrefix} '${actual.nombre.toUpperCase()}' con DPI ${actual.dpi}.`;
                    registrarBitacora(operador_id, actual.nombre, `BAJA_${auditPrefix.toUpperCase()}`, operador_nombre, detalles);

                    return res.status(200).send(`${entityLabel} eliminado con exito`);
                });
            }
        );
    });

    return router;
};

module.exports = crearRouterCrudPersona;
