const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

// === OBTENER CATÁLOGO DE DEPARTAMENTOS (AUXILIAR PARA SELECTORS) ===
router.get("/departamentos", (req, res) => {
    db.query("SELECT id_departamento, nombre_departamento FROM departamentos WHERE estado = 'activo' ORDER BY nombre_departamento ASC", (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al obtener el catálogo de departamentos");
        } else {
            res.send(result);
        }
    });
});

// === CREAR MUNICIPIOS (CON BITÁCORA) ===
router.post("/crear", (req, res) => {
    const { nombre_municipio, estado, id_departamento, id_usuario_operador, nombre_usuario_operador } = req.body;

    // Inserción directa
    db.query(
        'INSERT INTO municipios(nombre_municipio, estado, id_departamento) VALUES (?,?,?)',
        [nombre_municipio, estado, id_departamento],
        (insertErr, insertResult) => {
            if (insertErr) {
                console.error(insertErr);
                return res.status(500).send("Error al registrar el municipio");
            }

            // Buscamos el nombre del departamento para dejar un detalle descriptivo en la bitácora
            db.query('SELECT nombre_departamento FROM departamentos WHERE id_departamento = ?', [id_departamento], (errDep, resDep) => {
                const deptoNombre = resDep && resDep.length > 0 ? resDep[0].nombre_departamento : `ID: ${id_departamento}`;
                const nuevoId = insertResult.insertId;
                const detalles = `Se registró el municipio '${nombre_municipio.toUpperCase()}' asignado al departamento '${deptoNombre}' con estado inicial '${estado.toUpperCase()}' (ID: #${nuevoId}).`;

                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'INSERCION', ?, ?)
                `;

                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    return res.status(200).send("Municipio registrado con éxito!!!");
                });
            });
        }
    );
});

// === LISTAR MUNICIPIOS (CON INNER JOIN PARA TRAER EL NOMBRE DEL DEPARTAMENTO) ===
router.get("/", (req, res) => {
    const sqlQuery = `
        SELECT m.id_municipio, m.nombre_municipio, m.estado, m.id_departamento, d.nombre_departamento 
        FROM municipios m
        INNER JOIN departamentos d ON m.id_departamento = d.id_departamento
        ORDER BY d.nombre_departamento ASC, m.nombre_municipio ASC
    `;

    db.query(sqlQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al obtener municipios");
        } else {
            res.send(result); 
        }
    });
});

// === ACTUALIZAR MUNICIPIO (CON ANÁLISIS HISTÓRICO DE CAMBIOS) ===
router.put("/actualizar", (req, res) => {
    const { id_municipio, nombre_municipio, estado, id_departamento, id_usuario_operador, nombre_usuario_operador } = req.body;
    
    // 1. Obtener valores anteriores para documentar la auditoría exacta
    const sqlSelectOld = `
        SELECT m.*, d.nombre_departamento 
        FROM municipios m 
        LEFT JOIN departamentos d ON m.id_departamento = d.id_departamento 
        WHERE m.id_municipio = ?
    `;

    db.query(sqlSelectOld, [id_municipio], (errOld, resultOld) => {
        if (errOld || resultOld.length === 0) {
            console.error(errOld);
            return res.status(500).send("Error al verificar los datos previos del municipio");
        }

        const registroViejo = resultOld[0];

        // 2. Ejecutar la actualización
        db.query(
            'UPDATE municipios SET nombre_municipio=?, estado=?, id_departamento=? WHERE id_municipio=?',
            [nombre_municipio, estado, id_departamento, id_municipio],
            (updateErr, updateResult) => {
                if (updateErr) {
                    console.error(updateErr);
                    return res.status(500).send("Error al actualizar el municipio");
                }

                // 3. Evaluar qué campos cambiaron exactamente
                let cambios = [];
                if (registroViejo.nombre_municipio !== nombre_municipio) {
                    cambios.push(`Nombre: '${registroViejo.nombre_municipio}' -> '${nombre_municipio.toUpperCase()}'`);
                }
                if (registroViejo.estado !== estado) {
                    cambios.push(`Estado: '${registroViejo.estado}' -> '${estado}'`);
                }
                if (registroViejo.id_departamento !== parseInt(id_departamento)) {
                    cambios.push(`ID Depto Relacionado: '${registroViejo.id_departamento}' -> '${id_departamento}'`);
                }

                // 4. Registrar en bitácora si hubo modificaciones
                const detallesString = cambios.length > 0 
                    ? `Modificado por ${nombre_usuario_operador}. Cambios en municipio ID #${id_municipio}: ${cambios.join(', ')}`
                    : `Se guardó el municipio ID #${id_municipio} sin efectuar cambios en sus valores previos.`;

                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'ACTUALIZACION', ?, ?)
                `;

                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detallesString], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    return res.status(200).send("Municipio actualizado correctamente");
                });
            }
        );
    });
});

// === ELIMINAR MUNICIPIO (CON BITÁCORA) ===
router.delete("/delete/:id_municipio", (req, res) => {
    const { id_municipio } = req.params; 
    const { id_usuario_operador, nombre_usuario_operador } = req.query;

    // Capturar el nombre del municipio antes de removerlo
    db.query('SELECT nombre_municipio FROM municipios WHERE id_municipio = ?', [id_municipio], (errFind, resultFind) => {
        if (errFind || resultFind.length === 0) {
            return res.status(500).send("No se localizó el municipio a eliminar");
        }

        const nombreMuniEliminado = resultFind[0].nombre_municipio;

        db.query('DELETE FROM municipios WHERE id_municipio=?', [id_municipio], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error al eliminar el municipio");
            }

            // === REGISTRO EN BITÁCORA ===
            const detalles = `Se eliminó el municipio '${nombreMuniEliminado}' (ID previo: #${id_municipio}).`;
            const sqlBitacora = `
                INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                VALUES (?, 'ELIMINACION', ?, ?)
            `;

            db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                return res.status(200).send("Municipio eliminado correctamente"); 
            });
        });
    });
});

module.exports = router;