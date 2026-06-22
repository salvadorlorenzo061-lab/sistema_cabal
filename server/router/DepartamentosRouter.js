const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

// === LISTAR TODOS LOS DEPARTAMENTOS ===
router.get("/", (req, res) => {
    const sqlQuery = `
        SELECT id_departamento, nombre_departamento, estado 
        FROM departamentos 
        ORDER BY nombre_departamento ASC
    `;

    db.query(sqlQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al obtener departamentos");
        } else {
            res.send(result); 
        }
    });
});

// === CREAR DEPARTAMENTO (CON BITÁCORA) ===
router.post("/crear", (req, res) => {
    // Recibimos los datos del depto + datos del operador desde el frontend
    const { nombre_departamento, estado, id_usuario_operador, nombre_usuario_operador } = req.body;

    // Validación: que no exista otro departamento con el mismo nombre
    db.query('SELECT * FROM departamentos WHERE nombre_departamento = ?', [nombre_departamento], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error interno del servidor");
        }

        if (result.length > 0) {
            return res.status(400).send({ message: "Este departamento ya se encuentra registrado" });
        }

        // Inserción en la base de datos
        db.query(
            'INSERT INTO departamentos(nombre_departamento, estado) VALUES (?,?)',
            [nombre_departamento, estado],
            (insertErr, insertResult) => {
                if (insertErr) {
                    console.error(insertErr);
                    return res.status(500).send("Error al registrar el departamento");
                }

                // === REGISTRO EN BITÁCORA ===
                const nuevoId = insertResult.insertId;
                const detalles = `Se registró el departamento: '${nombre_departamento.toUpperCase()}' con estado inicial '${estado.toUpperCase()}' (ID: #${nuevoId}).`;
                
                const sqlBitacora = `
                    INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                    VALUES (?, 'INSERCION', ?, ?)
                `;

                db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                    if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                    
                    // Respondemos éxito pase lo que pase con la bitácora
                    return res.status(200).send("Departamento registrado con éxito!!!");
                });
            }
        );
    });
});

// === ACTUALIZAR DEPARTAMENTO (CON DETALLE HISTÓRICO DE CAMBIOS) ===
router.put("/actualizar", (req, res) => {
    const { id_departamento, nombre_departamento, estado, id_usuario_operador, nombre_usuario_operador } = req.body;
    
    // 1. Obtener los valores actuales antes de sobreescribirlos para comparar el historial
    db.query('SELECT * FROM departamentos WHERE id_departamento = ?', [id_departamento], (errOld, resultOld) => {
        if (errOld) {
            console.error(errOld);
            return res.status(500).send("Error interno del servidor");
        }
        if (resultOld.length === 0) {
            return res.status(404).send("Departamento no encontrado");
        }

        const registroViejo = resultOld[0];

        // 2. Validación de duplicados en otros registros
        db.query('SELECT * FROM departamentos WHERE nombre_departamento = ? AND id_departamento != ?', [nombre_departamento, id_departamento], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error interno del servidor");
            }

            if (result.length > 0) {
                return res.status(400).send({ message: "Ya existe otro departamento con este nombre" });
            }

            // 3. Actualización de los datos
            db.query(
                'UPDATE departamentos SET nombre_departamento=?, estado=? WHERE id_departamento=?',
                [nombre_departamento, estado, id_departamento],
                (updateErr, updateResult) => {
                    if (updateErr) {
                        console.error(updateErr);
                        return res.status(500).send("Error al actualizar el departamento");
                    }

                    // 4. Evaluar qué cambió exactamente para guardar el historial exacto
                    let cambios = [];
                    if (registroViejo.nombre_departamento !== nombre_departamento) {
                        cambios.push(`Nombre: '${registroViejo.nombre_departamento}' -> '${nombre_departamento.toUpperCase()}'`);
                    }
                    if (registroViejo.estado !== estado) {
                        cambios.push(`Estado: '${registroViejo.estado}' -> '${estado}'`);
                    }

                    // Construimos la cadena final de detalles
                    const detallesString = cambios.length > 0 
                        ? `Modificado por ${nombre_usuario_operador}. Cambios en depto ID #${id_departamento}: ${cambios.join(', ')}`
                        : `Se guardó el depto ID #${id_departamento} sin cambios en los valores anteriores.`;

                    // === REGISTRO EN BITÁCORA ===
                    const sqlBitacora = `
                        INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                        VALUES (?, 'ACTUALIZACION', ?, ?)
                    `;

                    db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detallesString], (bitacoraErr) => {
                        if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                        
                        return res.status(200).send("Departamento actualizado correctamente");
                    });
                }
            );
        });
    });
});

// === ELIMINAR DEPARTAMENTO (CON BITÁCORA) ===
// Pasamos las credenciales por Query String (?id_usuario_operador=...) debido a que las peticiones DELETE no usan cuerpo estructurado de forma estándar
router.delete("/delete/:id_departamento", (req, res) => {
    const { id_departamento } = req.params; 
    const { id_usuario_operador, nombre_usuario_operador } = req.query;

    // Primero capturamos el nombre actual para que la bitácora sepa qué se eliminó
    db.query('SELECT nombre_departamento FROM departamentos WHERE id_departamento = ?', [id_departamento], (errFind, resultFind) => {
        if (errFind || resultFind.length === 0) {
            return res.status(500).send("No se pudo pre-localizar el departamento a eliminar");
        }
        
        const deptoNombreEliminado = resultFind[0].nombre_departamento;

        // Procedemos a borrar
        db.query('DELETE FROM departamentos WHERE id_departamento=?', [id_departamento], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error al eliminar el departamento");
            }

            // === REGISTRO EN BITÁCORA ===
            const detalles = `Se eliminó permanentemente el departamento '${deptoNombreEliminado}' (ID previo: #${id_departamento}).`;
            const sqlBitacora = `
                INSERT INTO bitacora (id_usuario, tipo_movimiento, ejecutado_por, detalles) 
                VALUES (?, 'ELIMINACION', ?, ?)
            `;

            db.query(sqlBitacora, [id_usuario_operador, nombre_usuario_operador, detalles], (bitacoraErr) => {
                if (bitacoraErr) console.error("Error al escribir en bitácora:", bitacoraErr);
                
                return res.status(200).send("Departamento eliminado correctamente"); 
            });
        });
    });
});

module.exports = router;