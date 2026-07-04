const express = require('express');
const db = require('../Conexion'); 
const router = express.Router(); 

// Función auxiliar inmutable para disparar la bitácora automáticamente
const registrarAuditoria = (idUsuario, afectado, tipo, ejecutor, detalles) => {
    const queryAuditoria = `
        INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;
    db.query(queryAuditoria, [idUsuario, afectado, tipo, ejecutor, detalles], (err) => {
        if (err) console.error("🚨 Error silencioso al generar traza de auditoría:", err);
    });
};

// ==========================================
// ➕ POST: CREAR ALDEA / CASERÍO / COMUNIDAD
// ==========================================
router.post("/crear", (req, res) => {
    // Agregamos 'ejecutado_por' e 'id_usuario' (puedes mandarlos desde el front según la sesión activa)
    const { nombre_comunidad, tipo, estado, id_municipio, ejecutado_por, id_usuario } = req.body;

    if (!nombre_comunidad || !id_municipio) {
        return res.status(400).send({ message: "Faltan parámetros obligatorios: nombre_comunidad o id_municipio." });
    }

    const municipioId = parseInt(id_municipio, 10);

    db.query(
        'SELECT * FROM comunidades WHERE nombre_comunidad = ? AND id_municipio = ?', 
        [nombre_comunidad.trim(), municipioId], 
        (err, result) => {
            if (err) {
                console.error("🚨 Error al validar duplicado en MySQL:", err);
                return res.status(500).send({ message: "Error interno del servidor al validar el lugar" });
            }
            
            if (result && result.length > 0) {
                return res.status(400).send({ message: "Esta comunidad ya se encuentra registrada en este municipio." });
            }

            db.query(
                'INSERT INTO comunidades (nombre_comunidad, tipo, estado, id_municipio) VALUES (?, ?, ?, ?)',
                [nombre_comunidad.trim(), tipo, estado || 'activo', municipioId],
                (insertErr, insertResult) => {
                    if (insertErr) {
                        console.error("🚨 Error en el INSERT de comunidades:", insertErr);
                        return res.status(500).send({ message: "Error al registrar la comunidad: " + insertErr.message });
                    }

                    // 🛡️ TRAZA DE AUDITORÍA AUTOMÁTICA
                    registrarAuditoria(
                        id_usuario || null,
                        `COMUNIDAD: ${nombre_comunidad.toUpperCase()}`,
                        'CREACION',
                        ejecutado_por || 'SISTEMA',
                        `Se dio de alta el lugar geográfico del tipo [${tipo.toUpperCase()}] en el municipio ID: ${municipioId}`
                    );

                    return res.status(200).send("¡Comunidad registrada con éxito!");
                }
            );
        }
    );
});

// ==========================================
// 🔍 GET: LISTAR COMUNIDADES
// ==========================================
router.get("/", (req, res) => {
    const pagina = Math.max(parseInt(req.query.pagina || '1', 10), 1);
    const limite = Math.max(parseInt(req.query.limite || '10', 10), 1);
    const offset = (pagina - 1) * limite;

    const sqlQuery = `
        SELECT 
            c.id_comunidad, 
            c.nombre_comunidad, 
            c.tipo, 
            c.estado,
            c.id_municipio, 
            COALESCE(m.nombre_municipio, 'Sin Asignar') AS nombre_municipio,
            m.id_departamento, 
            COALESCE(d.nombre_departamento, 'Sin Asignar') AS nombre_departamento
        FROM comunidades c
        LEFT JOIN municipios m ON c.id_municipio = m.id_municipio
        LEFT JOIN departamentos d ON m.id_departamento = d.id_departamento
        ORDER BY d.nombre_departamento ASC, m.nombre_municipio ASC, c.nombre_comunidad ASC
        LIMIT ? OFFSET ?
    `;

    db.query('SELECT COUNT(*) AS total FROM comunidades', (countErr, countResult) => {
        if (countErr) {
            console.error("🚨 Error contando comunidades:", countErr);
            return res.status(500).send("Error al cargar el catálogo de comunidades");
        }

        db.query(sqlQuery, [limite, offset], (err, result) => {
            if (err) {
                console.error("🚨 Error en GET de comunidades:", err);
                return res.status(500).send("Error al cargar el catálogo de comunidades");
            }
            res.send({
                data: result,
                total: countResult[0].total,
                paginasTotales: Math.ceil(countResult[0].total / limite),
                paginaActual: pagina
            }); 
        });
    });
});

// ==========================================
// ✏️ PUT: ACTUALIZAR COMUNIDAD
// ==========================================
router.put("/actualizar", (req, res) => {
    const { id_comunidad, nombre_comunidad, tipo, estado, id_municipio, ejecutado_por, id_usuario } = req.body;
    
    if (!id_comunidad || !nombre_comunidad || !id_municipio) {
        return res.status(400).send("Faltan campos mandatorios para actualizar.");
    }

    db.query(
        'UPDATE comunidades SET nombre_comunidad=?, tipo=?, estado=?, id_municipio=? WHERE id_comunidad=?',
        [nombre_comunidad.trim(), tipo, estado, parseInt(id_municipio, 10), parseInt(id_comunidad, 10)],
        (err, result) => {
            if (err) {
                console.error("🚨 Error al actualizar comunidad:", err);
                return res.status(500).send("Error al actualizar la comunidad");
            }

            // 🛡️ TRAZA DE AUDITORÍA AUTOMÁTICA
            registrarAuditoria(
                id_usuario || null,
                `COMUNIDAD: ${nombre_comunidad.toUpperCase()}`,
                'ACTUALIZACION',
                ejecutado_por || 'SISTEMA',
                `Modificación estructural en el registro #${id_comunidad}. Clasificación: ${tipo.toUpperCase()}, Estado: ${estado.toUpperCase()}`
            );

            res.status(200).send("Registro actualizado correctamente");
        }
    );
});

// ==========================================
// ❌ DELETE: ELIMINAR COMUNIDAD
// ==========================================
router.delete("/delete/:id_comunidad", (req, res) => {
    const { id_comunidad } = req.params; 
    // Para el DELETE necesitamos saber quién borró, lo capturamos opcionalmente por query headers o params alternos
    const ejecutado_por = req.query.ejecutado_por || 'SISTEMA';
    const id_usuario = req.query.id_usuario || null;

    // Buscamos el nombre antes de borrarlo para que la bitácora conserve el dato legible
    db.query('SELECT nombre_comunidad FROM comunidades WHERE id_comunidad = ?', [parseInt(id_comunidad, 10)], (searchErr, searchRes) => {
        const nombreEliminado = (searchRes && searchRes.length > 0) ? searchRes[0].nombre_comunidad : "DESCONOCIDO";

        db.query(
            'DELETE FROM comunidades WHERE id_comunidad = ?', 
            [parseInt(id_comunidad, 10)], 
            (err, result) => {
                if (err) {
                    console.error("🚨 Error al eliminar comunidad:", err);
                    return res.status(500).send("Error al eliminar la ubicación física");
                }

                // 🛡️ TRAZA DE AUDITORÍA AUTOMÁTICA
                registrarAuditoria(
                    id_usuario,
                    `ELIMINADO: ${nombreEliminado.toUpperCase()}`,
                    'ELIMINACION',
                    ejecutado_por,
                    `Se purgó definitivamente de la base de datos la comunidad con ID correlativo #${id_comunidad}`
                );

                res.status(200).send("Ubicación borrada correctamente"); 
            }
        );
    });
});

module.exports = router;