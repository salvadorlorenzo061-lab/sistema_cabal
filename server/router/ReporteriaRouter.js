const express = require('express');
const db = require('../Conexion');

const router = express.Router();

const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

let schemaPromise;
const agregarColumnaSiFalta = (sql) => query(sql).catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
});

const prepararEsquema = () => {
    if (schemaPromise) return schemaPromise;

    schemaPromise = query(`
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
    `)
        .then(() => agregarColumnaSiFalta('ALTER TABLE reporteria_flujo ADD COLUMN observacion TEXT DEFAULT NULL'))
        .then(() => agregarColumnaSiFalta('ALTER TABLE reporteria_flujo ADD COLUMN asignado_a INT DEFAULT NULL'))
        .then(() => agregarColumnaSiFalta('ALTER TABLE reporteria_flujo ADD COLUMN asignado_por INT DEFAULT NULL'))
        .then(() => agregarColumnaSiFalta('ALTER TABLE reporteria_flujo ADD COLUMN fecha_asignacion DATETIME DEFAULT NULL'))
        .then(() => agregarColumnaSiFalta('ALTER TABLE reporteria_flujo ADD COLUMN fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
        .then(() => query("UPDATE reporteria_flujo SET estado='Trabajado' WHERE estado='Finalizada'"))
        .then(() => query("UPDATE reporteria_flujo SET estado='Pendiente' WHERE estado='Activo'"))
        .then(() => agregarColumnaSiFalta('ALTER TABLE afiliados ADD COLUMN id_creador INT DEFAULT NULL AFTER id_usuario'))
        .then(() => query('UPDATE afiliados SET id_creador=id_usuario WHERE id_creador IS NULL'))
        .then(() => agregarColumnaSiFalta('ALTER TABLE problemas ADD COLUMN id_usuario INT DEFAULT NULL'))
        .then(() => query(`
            UPDATE problemas p
            LEFT JOIN afiliados a ON a.id_afiliado = p.id_afiliado
            SET p.id_usuario = a.id_usuario
            WHERE p.id_usuario IS NULL AND a.id_usuario IS NOT NULL
        `));

    return schemaPromise;
};

const FUENTES = {
    cocode: {
        label: 'Incidente Cocode',
        listar: `
            SELECT 'cocode' AS modulo, a.id_afiliado AS id_registro,
                a.nombre_completo AS titulo,
                CONCAT_WS(' | ', NULLIF(a.direccion, ''), NULLIF(a.barrio_colonia, '')) AS detalle,
                'Activo' AS estado_origen, a.fecha_afiliacion AS fecha_registro,
                COALESCE(a.id_creador, a.id_usuario) AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM afiliados a LEFT JOIN usuarios u ON u.id_usuario = COALESCE(a.id_creador, a.id_usuario)
        `,
        propietario: 'SELECT COALESCE(a.id_creador, a.id_usuario) AS id_propietario FROM afiliados a WHERE a.id_afiliado=?',
        actualizar: 'UPDATE afiliados SET nombre_completo=?, direccion=? WHERE id_afiliado=?',
        eliminar: 'DELETE FROM afiliados WHERE id_afiliado=?'
    },
    problemas: {
        label: 'Incidente COCODE',
        listar: `
            SELECT 'problemas' AS modulo, p.id_problema AS id_registro,
                p.titulo, p.descripcion AS detalle, p.estado AS estado_origen,
                p.fecha_reporte AS fecha_registro, p.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM problemas p
            LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
        `,
        propietario: 'SELECT p.id_usuario AS id_propietario FROM problemas p WHERE p.id_problema=?',
        actualizar: 'UPDATE problemas SET titulo=?, descripcion=? WHERE id_problema=?',
        eliminar: 'DELETE FROM problemas WHERE id_problema=?'
    },
    lideres: {
        label: 'Lideres',
        listar: `
            SELECT 'lideres' AS modulo, l.id_lider AS id_registro, l.nombre AS titulo,
                l.observaciones AS detalle, l.estado AS estado_origen,
                l.fecha_creacion AS fecha_registro, l.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM lideres l LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
        `,
        propietario: 'SELECT l.id_usuario AS id_propietario FROM lideres l WHERE l.id_lider=?',
        actualizar: 'UPDATE lideres SET nombre=?, observaciones=? WHERE id_lider=?',
        eliminar: 'DELETE FROM lideres WHERE id_lider=?'
    },
    propersonales: {
        label: 'Incidentes personales',
        listar: `
            SELECT 'propersonales' AS modulo, p.id_propersonal AS id_registro, p.nombre AS titulo,
                p.observaciones AS detalle, p.estado AS estado_origen,
                p.fecha_creacion AS fecha_registro, p.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM problemas_personales p LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
        `,
        propietario: 'SELECT p.id_usuario AS id_propietario FROM problemas_personales p WHERE p.id_propersonal=?',
        actualizar: 'UPDATE problemas_personales SET nombre=?, observaciones=? WHERE id_propersonal=?',
        eliminar: 'DELETE FROM problemas_personales WHERE id_propersonal=?'
    }
};

const obtenerSolicitante = async (idUsuario) => {
    const rows = await query('SELECT id_usuario, nombre, rol FROM usuarios WHERE id_usuario=? AND LOWER(estado)=\'activo\'', [idUsuario]);
    return rows[0] || null;
};

const esSupervisorGeneral = (rol) => String(rol || '').trim().toLowerCase() === 'supervisor general';
const esAdministrador = (rol) => String(rol || '').trim().toLowerCase() === 'admin';
const tieneVistaGlobal = (rol) => esAdministrador(rol) || esSupervisorGeneral(rol);

const obtenerFlujo = async (modulo, idRegistro) => {
    const rows = await query(
        'SELECT asignado_a FROM reporteria_flujo WHERE modulo=? AND id_registro=?',
        [modulo, idRegistro]
    );
    return rows[0] || null;
};

const autorizarRegistro = async (solicitante, fuente, idRegistro) => {
    const rows = await query(fuente.propietario, [idRegistro]);
    if (!rows.length) return { existe: false, autorizado: false };
    const flujo = await obtenerFlujo(Object.keys(FUENTES).find((key) => FUENTES[key] === fuente), idRegistro);
    return {
        existe: true,
        idPropietario: Number(rows[0].id_propietario) || null,
        autorizado: tieneVistaGlobal(solicitante.rol)
            || Number(rows[0].id_propietario) === Number(solicitante.id_usuario)
            || Number(flujo?.asignado_a) === Number(solicitante.id_usuario)
    };
};

const registrarBitacora = (solicitante, tipo, detalle) => query(`
    INSERT INTO bitacora (id_usuario, usuario_afectado, tipo_movimiento, ejecutado_por, detalles, fecha_movimiento)
    VALUES (?, ?, ?, ?, ?, NOW())
`, [solicitante.id_usuario, solicitante.nombre, tipo, solicitante.nombre, detalle]).catch((err) => {
    console.error('Error registrando accion de reporteria:', err);
});

router.use(async (req, res, next) => {
    try {
        await prepararEsquema();
        const idUsuario = Number(req.query.id_usuario || req.body?.id_usuario || req.body?.id_usuario_operador || 0);
        if (!idUsuario) return res.status(401).json({ message: 'Sesion no identificada.' });

        const solicitante = await obtenerSolicitante(idUsuario);
        if (!solicitante) return res.status(401).json({ message: 'La sesion no corresponde a un usuario activo.' });

        req.solicitante = solicitante;
        return next();
    } catch (err) {
        console.error('Error preparando reporteria:', err);
        return res.status(500).json({ message: 'No se pudo preparar el modulo de reporteria.' });
    }
});

router.get('/', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const pagina = Math.max(Number(req.query.pagina) || 1, 1);
        const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 100);
        const busqueda = String(req.query.busqueda || '').trim().toLowerCase();
        const modulo = String(req.query.modulo || '').trim().toLowerCase();
        const estadoTarea = String(req.query.estado || '').trim();
        const solicitante = req.solicitante;

        const resultados = (await Promise.all(Object.values(FUENTES).map((fuente) => query(fuente.listar)))).flat();
        const flujos = await query('SELECT * FROM reporteria_flujo');
        const flujoMap = new Map(flujos.map((item) => [`${item.modulo}:${item.id_registro}`, item]));
        const usuariosAsignados = await query('SELECT id_usuario, nombre FROM usuarios');
        const usuariosMap = new Map(usuariosAsignados.map((item) => [Number(item.id_usuario), item.nombre]));

        const filtrados = resultados
            .filter((item) => {
                const flujo = flujoMap.get(`${item.modulo}:${item.id_registro}`);
                if (tieneVistaGlobal(solicitante.rol)) return true;
                if (flujo?.asignado_a) {
                    return Number(flujo.asignado_a) === Number(solicitante.id_usuario);
                }
                return Number(item.id_propietario) === Number(solicitante.id_usuario);
            })
            .filter((item) => !modulo || item.modulo === modulo)
            .filter((item) => !busqueda || [item.titulo, item.detalle, item.propietario, item.modulo]
                .some((valor) => String(valor || '').toLowerCase().includes(busqueda)))
            .map((item) => {
                const flujo = flujoMap.get(`${item.modulo}:${item.id_registro}`);
                return {
                    ...item,
                    modulo_label: FUENTES[item.modulo].label,
                    estado_tarea: flujo?.estado || 'Pendiente',
                    observacion: flujo?.observacion || '',
                    asignado_a: flujo?.asignado_a || null,
                    asignado_nombre: flujo?.asignado_a ? usuariosMap.get(Number(flujo.asignado_a)) || 'Usuario no disponible' : '',
                    fecha_asignacion: flujo?.fecha_asignacion || null,
                    fecha_finalizacion: flujo?.fecha_finalizacion || null,
                    es_ticket: true,
                    puede_gestionar: (
                        tieneVistaGlobal(solicitante.rol)
                        || Number(flujo?.asignado_a) === Number(solicitante.id_usuario)
                        || (!flujo?.asignado_a && Number(item.id_propietario) === Number(solicitante.id_usuario))
                    ),
                    puede_asignar: tieneVistaGlobal(solicitante.rol),
                    puede_editar: esAdministrador(solicitante.rol),
                    puede_eliminar: esAdministrador(solicitante.rol)
                };
            })
            .filter((item) => !estadoTarea || item.estado_tarea === estadoTarea)
            .sort((a, b) => new Date(b.fecha_registro || 0) - new Date(a.fecha_registro || 0));

        const offset = (pagina - 1) * limite;
        return res.json({
            data: filtrados.slice(offset, offset + limite),
            total: filtrados.length,
            paginasTotales: Math.max(Math.ceil(filtrados.length / limite), 1),
            paginaActual: pagina
        });
    } catch (err) {
        console.error('Error listando reporteria:', err);
        return res.status(500).json({ message: 'No se pudo cargar la reporteria consolidada.' });
    }
});

router.get('/usuarios-asignables/lista', async (req, res) => {
    try {
        const usuarios = await query(`
            SELECT id_usuario, nombre, rol
            FROM usuarios
            WHERE LOWER(estado)='activo'
            ORDER BY nombre ASC
        `);
        return res.json(usuarios);
    } catch (err) {
        console.error('Error listando usuarios asignables:', err);
        return res.status(500).json({ message: 'No se pudo cargar la lista de usuarios.' });
    }
});

router.patch('/:modulo/:id/asignar', async (req, res) => {
    try {
        if (!tieneVistaGlobal(req.solicitante.rol)) {
            return res.status(403).json({ message: 'Solo ADMIN o Supervisor General puede asignar trabajo.' });
        }

        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        const asignadoA = Number(req.body.asignado_a || 0);
        if (!fuente || !idRegistro || !asignadoA) {
            return res.status(400).json({ message: 'Registro o usuario de asignacion invalido.' });
        }

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });

        const usuarios = await query(
            "SELECT id_usuario, nombre FROM usuarios WHERE id_usuario=? AND LOWER(estado)='activo'",
            [asignadoA]
        );
        if (!usuarios.length) return res.status(404).json({ message: 'Usuario asignado no encontrado o inactivo.' });

        await query(`
            INSERT INTO reporteria_flujo (modulo, id_registro, estado, asignado_a, asignado_por, fecha_asignacion)
            VALUES (?, ?, 'Pendiente', ?, ?, NOW())
            ON DUPLICATE KEY UPDATE asignado_a=VALUES(asignado_a), asignado_por=VALUES(asignado_por), fecha_asignacion=NOW()
        `, [req.params.modulo, idRegistro, asignadoA, req.solicitante.id_usuario]);
        await registrarBitacora(
            req.solicitante,
            'ASIGNACION_REPORTERIA',
            `Asigno ${fuente.label} #${idRegistro} a ${usuarios[0].nombre}.`
        );
        return res.json({ message: `Trabajo asignado a ${usuarios[0].nombre}.` });
    } catch (err) {
        console.error('Error asignando trabajo:', err);
        return res.status(500).json({ message: 'No se pudo asignar el trabajo.' });
    }
});

router.put('/:modulo/:id', async (req, res) => {
    try {
        if (!esAdministrador(req.solicitante.rol)) {
            return res.status(403).json({ message: 'Solo el rol ADMIN puede editar cualquier registro.' });
        }

        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        const titulo = String(req.body.titulo || '').trim();
        const detalle = String(req.body.detalle || '').trim();
        if (!fuente || !fuente.actualizar || !idRegistro || !titulo) {
            return res.status(400).json({ message: 'Datos de actualización inválidos.' });
        }

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });

        await query(fuente.actualizar, [titulo, detalle || null, idRegistro]);
        await registrarBitacora(
            req.solicitante,
            'ACTUALIZACION_REPORTERIA',
            `ADMIN actualizó ${fuente.label} #${idRegistro} desde Reportería.`
        );
        return res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        console.error('Error actualizando ticket desde Reportería:', err);
        return res.status(500).json({ message: 'No se pudo actualizar el ticket.' });
    }
});

router.delete('/:modulo/:id', async (req, res) => {
    try {
        if (!esAdministrador(req.solicitante.rol)) {
            return res.status(403).json({ message: 'Solo el rol ADMIN puede eliminar cualquier registro.' });
        }

        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        if (!fuente || !fuente.eliminar || !idRegistro) {
            return res.status(400).json({ message: 'Registro inválido.' });
        }

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });

        await query(fuente.eliminar, [idRegistro]);
        await query('DELETE FROM reporteria_flujo WHERE modulo=? AND id_registro=?', [req.params.modulo, idRegistro]);
        await registrarBitacora(
            req.solicitante,
            'ELIMINACION_REPORTERIA',
            `ADMIN eliminó ${fuente.label} #${idRegistro} desde Reportería.`
        );
        return res.json({ message: 'Registro eliminado correctamente.' });
    } catch (err) {
        console.error('Error eliminando ticket desde Reportería:', err);
        const message = err.code === 'ER_ROW_IS_REFERENCED_2'
            ? 'El registro tiene información relacionada y no puede eliminarse.'
            : 'No se pudo eliminar el registro.';
        return res.status(500).json({ message });
    }
});

router.patch('/:modulo/:id/estado', async (req, res) => {
    try {
        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        const estado = String(req.body.estado || '').trim();
        const observacion = String(req.body.observacion || '').trim();
        if (!fuente || !idRegistro) return res.status(400).json({ message: 'Registro invalido.' });
        if (!['Pendiente', 'Trabajado', 'No trabajado'].includes(estado)) {
            return res.status(400).json({ message: 'Estado de tarea invalido.' });
        }
        const esResultadoFinal = estado === 'Trabajado' || estado === 'No trabajado';
        if (esResultadoFinal && !observacion) {
            return res.status(400).json({ message: 'Debe indicar la observacion del resultado del ticket.' });
        }

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });
        if (!acceso.autorizado) return res.status(403).json({ message: 'El registro pertenece a otro usuario y no le ha sido asignado.' });
        const flujo = await obtenerFlujo(req.params.modulo, idRegistro);
        const puedeGestionar = tieneVistaGlobal(req.solicitante.rol)
            || Number(flujo?.asignado_a) === Number(req.solicitante.id_usuario)
            || (!flujo?.asignado_a && Number(acceso.idPropietario) === Number(req.solicitante.id_usuario));
        if (!puedeGestionar) {
            return res.status(403).json({ message: 'Solo el encargado asignado puede dar seguimiento o finalizar este ticket.' });
        }

        await query(`
            INSERT INTO reporteria_flujo (modulo, id_registro, estado, observacion, finalizado_por, fecha_finalizacion)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE estado=VALUES(estado), observacion=VALUES(observacion),
                finalizado_por=VALUES(finalizado_por), fecha_finalizacion=VALUES(fecha_finalizacion)
        `, [
            req.params.modulo,
            idRegistro,
            estado,
            observacion || null,
            esResultadoFinal ? req.solicitante.id_usuario : null,
            esResultadoFinal ? new Date() : null
        ]);
        await registrarBitacora(
            req.solicitante,
            esResultadoFinal ? 'FINALIZACION_REPORTERIA' : 'ESTADO_REPORTERIA',
            `Cambio ${fuente.label} #${idRegistro} a ${estado}.${observacion ? ` Observacion: ${observacion}` : ''}`
        );
        return res.json({ message: `Tarea actualizada a ${estado}.` });
    } catch (err) {
        console.error('Error finalizando tarea:', err);
        return res.status(500).json({ message: 'No se pudo finalizar la tarea.' });
    }
});

module.exports = router;
