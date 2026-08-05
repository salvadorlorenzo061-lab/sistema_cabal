const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

// === OBTENER CATÁLOGO DE MUNICIPIOS (AUXILIAR PARA SELECTORS) ===
router.get("/municipios", (req, res) => {
    db.query("SELECT id_municipio, nombre_municipio FROM municipios WHERE estado = 'activo' ORDER BY nombre_municipio ASC", (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al obtener el catálogo de municipios");
        } else {
            res.send(result);
        }
    });
});

// === CREAR INCIDENCIAS / PROBLEMAS (CON BITÁCORA) ===
router.post("/crear", (req, res) => {
    const { titulo, descripcion, barrio_colonia, id_municipio, estado, id_afiliado, id_usuario_operador, nombre_usuario_operador } = req.body;
    const fecha_reporte = new Date(); // Captura temporal del servidor

    db.query(
        'INSERT INTO problemas(titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, id_afiliado) VALUES (?,?,?,?,?,?,?)',
        [titulo, descripcion, barrio_colonia, id_municipio, estado, fecha_reporte, id_afiliado],
        (insertErr, insertResult) => {
            if (insertErr) {
                console.error(insertErr);
                return res.status(500).send("Error al registrar la incidencia en el sistema");
            }

            // Consulta descriptiva para enriquecer la bitácora de auditoría
            db.query('SELECT nombre_municipio FROM municipios WHERE id_municipio = ?', [id_municipio], (errMuni, resMuni) => {
                const muniNombre = resMuni && resMuni.length > 0 ? resMuni[0].nombre_municipio : `ID: ${id_municipio}`;
                const nuevoId = insertResult.insertId;
                const detalles = `Se reportó la incidencia '${titulo.toUpperCase()}' en el barrio/colonia '${barrio_colonia.toUpperCase()}', ${muniNombre.toUpperCase()}. Registrado con estado inicial '${estado.toUpperCase()}' por afiliado ID #${id_afiliado} (ID Registro: #${nuevoId}).`;

                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'INSERCION', ?, ?)
                `;

                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    return res.status(200).send("Problema de la comunidad registrado con éxito");
                });
            });
        }
    );
});

// === LISTAR PROBLEMAS (CON INNER JOIN PARA TRAER EL NOMBRE DEL MUNICIPIO) ===
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;

    const sqlQuery = `
        SELECT p.id_problema, p.titulo, p.descripcion, p.barrio_colonia, p.id_municipio, p.estado, p.fecha_reporte, p.id_afiliado, m.nombre_municipio
        FROM problemas p
        INNER JOIN municipios m ON p.id_municipio = m.id_municipio
        ORDER BY p.fecha_reporte DESC
        LIMIT ? OFFSET ?
    `;

    db.query('SELECT COUNT(*) AS total FROM problemas', (countErr, countResult) => {
        if (countErr) {
            console.error(countErr);
            return res.status(500).send("Error al obtener el listado de problemas");
        }

        db.query(sqlQuery, [limite, offset], (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send("Error al obtener el listado de problemas");
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

// === ACTUALIZAR PROBLEMA (CON ANÁLISIS HISTÓRICO DE CAMBIOS) ===
router.put("/actualizar", (req, res) => {
    const { id_problema, titulo, descripcion, barrio_colonia, id_municipio, estado, id_afiliado, id_usuario_operador, nombre_usuario_operador } = req.body;
    
    // 1. Consultar estado histórico antes del UPDATE
    const sqlSelectOld = `SELECT * FROM problemas WHERE id_problema = ?`;

    db.query(sqlSelectOld, [id_problema], (errOld, resultOld) => {
        if (errOld || resultOld.length === 0) {
            console.error(errOld);
            return res.status(500).send("Error al verificar el registro previo de la incidencia");
        }

        const registroViejo = resultOld[0];

        // 2. Ejecutar la actualización en la tabla problemas
        db.query(
            'UPDATE problemas SET titulo=?, descripcion=?, barrio_colonia=?, id_municipio=?, estado=?, id_afiliado=? WHERE id_problema=?',
            [titulo, descripcion, barrio_colonia, id_municipio, estado, id_afiliado, id_problema],
            (updateErr, updateResult) => {
                if (updateErr) {
                    console.error(updateErr);
                    return res.status(500).send("Error al actualizar la incidencia");
                }

                // 3. Evaluar qué campos cambiaron exactamente para la Bitácora
                let cambios = [];
                if (registroViejo.titulo !== titulo) cambios.push(`Título: '${registroViejo.titulo}' -> '${titulo.toUpperCase()}'`);
                if (registroViejo.estado !== estado) cambios.push(`Estado: '${registroViejo.estado}' -> '${estado.toUpperCase()}'`);
                if (registroViejo.barrio_colonia !== barrio_colonia) cambios.push(`Barrio/Colonia: '${registroViejo.barrio_colonia}' -> '${barrio_colonia.toUpperCase()}'`);
                if (registroViejo.id_municipio !== parseInt(id_municipio)) cambios.push(`Muni ID: '${registroViejo.id_municipio}' -> '${id_municipio}'`);
                if (registroViejo.id_afiliado !== parseInt(id_afiliado)) cambios.push(`Afiliado ID: '${registroViejo.id_afiliado}' -> '${id_afiliado}'`);

                const detallesString = cambios.length > 0 
                    ? `Modificado por ${nombre_usuario_operador}. Cambios en problema ID #${id_problema}: ${cambios.join(', ')}`
                    : `Se guardó la incidencia ID #${id_problema} sin efectuar variaciones en sus campos primarios.`;

                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'ACTUALIZACION', ?, ?)
                `;

                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detallesString], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    return res.status(200).send("Incidencia actualizada correctamente");
                });
            }
        );
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