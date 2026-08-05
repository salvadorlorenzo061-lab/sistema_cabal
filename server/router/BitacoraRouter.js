const express = require("express");
const db = require('../Conexion'); 
const router = express.Router(); 

// === 1. OBTENER REGISTROS DE BITÁCORA CON FILTRADO Y PAGINACIÓN DESDE BD ===
router.get("/", (req, res) => {
    const { busqueda, tipo, fechaInicio, fechaFin, pagina = 1, limite = 10 } = req.query;
    
    let offset = (parseInt(pagina) - 1) * parseInt(limite);
    let condiciones = [];
    let parametros = [];

    // Filtro por tipo de movimiento (ej: ALTA_AFILIADO, CAMBIO_AFILIADO)
    if (tipo && tipo !== "") {
        condiciones.push("tipo_movimiento = ?");
        parametros.push(tipo);
    }

    // Filtro por rango de fechas
    if (fechaInicio && fechaInicio !== "") {
        condiciones.push("fecha_movimiento >= ?");
        parametros.push(`${fechaInicio} 00:00:00`);
    }
    if (fechaFin && fechaFin !== "") {
        condiciones.push("fecha_movimiento <= ?");
        parametros.push(`${fechaFin} 23:59:59`);
    }

    // Filtro de texto abierto (operador, detalles o afectado)
    if (busqueda && busqueda.trim() !== "") {
        condiciones.push("(usuario_afectado LIKE ? OR ejecutado_por LIKE ? OR detalles LIKE ?)");
        const term = `%${busqueda.trim()}%`;
        parametros.push(term, term, term);
    }

    // Construir la cláusula WHERE si existen filtros
    let whereClause = condiciones.length > 0 ? "WHERE " + condiciones.join(" AND ") : "";

    // Consulta para obtener los registros paginados
    const sqlQuery = `
        SELECT id_bitacora, id_usuario, usuario_afectado AS nombre_usuario_afectado, 
               fecha_movimiento, tipo_movimiento, ejecutado_por, detalles
        FROM bitacora
        ${whereClause}
        ORDER BY fecha_movimiento DESC
        LIMIT ? OFFSET ?
    `;

    // Consulta para saber el total de registros con esos filtros (para la paginación en React)
    const sqlCount = `SELECT COUNT(*) AS total FROM bitacora ${whereClause}`;

    db.query(sqlCount, parametros, (errCount, countResult) => {
        if (errCount) {
            console.error("Error al contar bitácora:", errCount);
            return res.status(500).send("Error en el servidor de auditoría");
        }

        const totalRegistros = countResult[0].total;

        // Añadimos los parámetros de paginación al array (deben ser enteros)
        db.query(sqlQuery, [...parametros, parseInt(limite), parseInt(offset)], (err, result) => {
            if (err) {
                console.error("Error al obtener la bitácora:", err);
                return res.status(500).send("Error al obtener los registros de auditoría");
            } 
            
            // Devolvemos los datos y la metadata de paginación
            res.json({
                data: result,
                total: totalRegistros,
                paginasTotales: Math.ceil(totalRegistros / limite),
                paginaActual: parseInt(pagina)
            });
        });
    });
});

// === 2. REGISTRAR UN NUEVO MOVIMIENTO ===
router.post("/", (req, res) => {
    const { id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles } = req.body;

    const sqlQuery = `
        INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

    db.query(sqlQuery, [id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles], (err, result) => {
        if (err) {
            console.error("❌ Error al insertar en la bitácora de auditoría:", err);
            return res.status(500).json({ error: "No se pudo registrar la traza de auditoría" });
        }
        return res.status(201).json({ 
            success: true, 
            message: "Movimiento de auditoría acumulado con éxito.",
            id: result.insertId 
        });
    });
});

module.exports = router;