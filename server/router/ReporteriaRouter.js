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
const prepararEsquema = () => {
    if (schemaPromise) return schemaPromise;

    schemaPromise = query(`
        CREATE TABLE IF NOT EXISTS reporteria_flujo (
            modulo VARCHAR(40) NOT NULL,
            id_registro INT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
            finalizado_por INT DEFAULT NULL,
            fecha_finalizacion DATETIME DEFAULT NULL,
            PRIMARY KEY (modulo, id_registro)
        )
    `).then(() => query('ALTER TABLE comunidades ADD COLUMN id_usuario INT DEFAULT NULL', []))
        .catch((err) => {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
        });

    return schemaPromise;
};

const FUENTES = {
    cocode: {
        label: 'COCODE',
        listar: `
            SELECT 'cocode' AS modulo, a.id_afiliado AS id_registro,
                a.nombre_completo AS titulo,
                CONCAT_WS(' | ', NULLIF(a.direccion, ''), NULLIF(a.barrio_colonia, '')) AS detalle,
                'Activo' AS estado_origen, a.fecha_afiliacion AS fecha_registro,
                a.id_usuario AS id_propietario, u.nombre AS propietario, u.rol AS rol_propietario
            FROM afiliados a LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
        `,
        propietario: 'SELECT u.rol FROM afiliados a LEFT JOIN usuarios u ON u.id_usuario=a.id_usuario WHERE a.id_afiliado=?',
        actualizar: 'UPDATE afiliados SET nombre_completo=?, direccion=? WHERE id_afiliado=?',
        eliminar: 'DELETE FROM afiliados WHERE id_afiliado=?'
    },
    problemas: {
        label: 'Problemas',
        listar: `
            SELECT 'problemas' AS modulo, p.id_problema AS id_registro,
                p.titulo, p.descripcion AS detalle, p.estado AS estado_origen,
                p.fecha_reporte AS fecha_registro, a.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM problemas p
            LEFT JOIN afiliados a ON a.id_afiliado = p.id_afiliado
            LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
        `,
        propietario: 'SELECT u.rol FROM problemas p LEFT JOIN afiliados a ON a.id_afiliado=p.id_afiliado LEFT JOIN usuarios u ON u.id_usuario=a.id_usuario WHERE p.id_problema=?',
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
        propietario: 'SELECT u.rol FROM lideres l LEFT JOIN usuarios u ON u.id_usuario=l.id_usuario WHERE l.id_lider=?',
        actualizar: 'UPDATE lideres SET nombre=?, observaciones=? WHERE id_lider=?',
        eliminar: 'DELETE FROM lideres WHERE id_lider=?'
    },
    propersonales: {
        label: 'Problemas personales',
        listar: `
            SELECT 'propersonales' AS modulo, p.id_propersonal AS id_registro, p.nombre AS titulo,
                p.observaciones AS detalle, p.estado AS estado_origen,
                p.fecha_creacion AS fecha_registro, p.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM problemas_personales p LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
        `,
        propietario: 'SELECT u.rol FROM problemas_personales p LEFT JOIN usuarios u ON u.id_usuario=p.id_usuario WHERE p.id_propersonal=?',
        actualizar: 'UPDATE problemas_personales SET nombre=?, observaciones=? WHERE id_propersonal=?',
        eliminar: 'DELETE FROM problemas_personales WHERE id_propersonal=?'
    },
    comunidades: {
        label: 'Comunidades',
        listar: `
            SELECT 'comunidades' AS modulo, c.id_comunidad AS id_registro,
                c.nombre_comunidad AS titulo, c.tipo AS detalle, c.estado AS estado_origen,
                NULL AS fecha_registro, c.id_usuario AS id_propietario,
                u.nombre AS propietario, u.rol AS rol_propietario
            FROM comunidades c LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
        `,
        propietario: 'SELECT u.rol FROM comunidades c LEFT JOIN usuarios u ON u.id_usuario=c.id_usuario WHERE c.id_comunidad=?',
        actualizar: 'UPDATE comunidades SET nombre_comunidad=?, tipo=? WHERE id_comunidad=?',
        eliminar: 'DELETE FROM comunidades WHERE id_comunidad=?'
    },
    usuarios: {
        label: 'Usuarios',
        listar: `
            SELECT 'usuarios' AS modulo, u.id_usuario AS id_registro, u.nombre AS titulo,
                u.correo AS detalle, u.estado AS estado_origen, u.fecha_creacion AS fecha_registro,
                u.id_usuario AS id_propietario, u.nombre AS propietario, u.rol AS rol_propietario
            FROM usuarios u
        `,
        propietario: 'SELECT rol FROM usuarios WHERE id_usuario=?',
        actualizar: 'UPDATE usuarios SET nombre=?, correo=? WHERE id_usuario=?',
        eliminar: 'DELETE FROM usuarios WHERE id_usuario=?'
    },
    roles: {
        label: 'Roles',
        listar: `
            SELECT 'roles' AS modulo, r.id_rol AS id_registro, r.nombre_rol AS titulo,
                r.descripcion AS detalle, r.estado AS estado_origen, NULL AS fecha_registro,
                NULL AS id_propietario, 'Configuracion del sistema' AS propietario,
                r.nombre_rol AS rol_propietario
            FROM roles r
        `,
        propietario: 'SELECT nombre_rol AS rol FROM roles WHERE id_rol=?'
    },
    bitacora: {
        label: 'Bitacora',
        listar: `
            SELECT 'bitacora' AS modulo, b.id_bitacora AS id_registro,
                b.tipo_movimiento AS titulo, b.detalles AS detalle,
                'Registrado' AS estado_origen, b.fecha_movimiento AS fecha_registro,
                b.id_usuario AS id_propietario, COALESCE(u.nombre, b.ejecutado_por) AS propietario,
                u.rol AS rol_propietario
            FROM bitacora b LEFT JOIN usuarios u ON u.id_usuario = b.id_usuario
        `,
        propietario: 'SELECT u.rol FROM bitacora b LEFT JOIN usuarios u ON u.id_usuario=b.id_usuario WHERE b.id_bitacora=?'
    }
};

const obtenerSolicitante = async (idUsuario) => {
    const rows = await query('SELECT id_usuario, nombre, rol FROM usuarios WHERE id_usuario=? AND LOWER(estado)=\'activo\'', [idUsuario]);
    return rows[0] || null;
};

const esGlobal = (rol) => ['administrador', 'admin', 'supervisor general'].includes(String(rol || '').trim().toLowerCase());
const mismoRol = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const autorizarRegistro = async (solicitante, fuente, idRegistro) => {
    const rows = await query(fuente.propietario, [idRegistro]);
    if (!rows.length) return { existe: false, autorizado: false };
    return {
        existe: true,
        autorizado: esGlobal(solicitante.rol) || mismoRol(rows[0].rol, solicitante.rol)
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
        const idUsuario = Number(req.query.id_usuario || req.body.id_usuario_operador || 0);
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
        const pagina = Math.max(Number(req.query.pagina) || 1, 1);
        const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 100);
        const busqueda = String(req.query.busqueda || '').trim().toLowerCase();
        const modulo = String(req.query.modulo || '').trim().toLowerCase();
        const solicitante = req.solicitante;

        const resultados = (await Promise.all(Object.values(FUENTES).map((fuente) => query(fuente.listar)))).flat();
        const flujos = await query('SELECT * FROM reporteria_flujo');
        const flujoMap = new Map(flujos.map((item) => [`${item.modulo}:${item.id_registro}`, item]));

        const filtrados = resultados
            .filter((item) => esGlobal(solicitante.rol) || mismoRol(item.rol_propietario, solicitante.rol))
            .filter((item) => !modulo || item.modulo === modulo)
            .filter((item) => !busqueda || [item.titulo, item.detalle, item.propietario, item.modulo]
                .some((valor) => String(valor || '').toLowerCase().includes(busqueda)))
            .map((item) => {
                const flujo = flujoMap.get(`${item.modulo}:${item.id_registro}`);
                return {
                    ...item,
                    modulo_label: FUENTES[item.modulo].label,
                    permite_editar: Boolean(FUENTES[item.modulo].actualizar),
                    permite_eliminar: Boolean(FUENTES[item.modulo].eliminar),
                    estado_tarea: flujo?.estado || 'Pendiente',
                    fecha_finalizacion: flujo?.fecha_finalizacion || null
                };
            })
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

router.put('/:modulo/:id', async (req, res) => {
    try {
        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        const titulo = String(req.body.titulo || '').trim();
        const detalle = String(req.body.detalle || '').trim();
        if (!fuente || !idRegistro || !titulo) return res.status(400).json({ message: 'Datos de actualizacion invalidos.' });
        if (!fuente.actualizar) return res.status(405).json({ message: 'Este modulo es de solo lectura en Reporteria.' });

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });
        if (!acceso.autorizado) return res.status(403).json({ message: 'El registro pertenece a otro rol.' });

        await query(fuente.actualizar, [titulo, detalle || null, idRegistro]);
        await registrarBitacora(req.solicitante, 'ACTUALIZACION_REPORTERIA', `Actualizo ${fuente.label} #${idRegistro} desde Reporteria.`);
        return res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        console.error('Error actualizando desde reporteria:', err);
        return res.status(500).json({ message: 'No se pudo actualizar el registro.' });
    }
});

router.patch('/:modulo/:id/finalizar', async (req, res) => {
    try {
        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        if (!fuente || !idRegistro) return res.status(400).json({ message: 'Registro invalido.' });

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });
        if (!acceso.autorizado) return res.status(403).json({ message: 'El registro pertenece a otro rol.' });

        await query(`
            INSERT INTO reporteria_flujo (modulo, id_registro, estado, finalizado_por, fecha_finalizacion)
            VALUES (?, ?, 'Finalizada', ?, NOW())
            ON DUPLICATE KEY UPDATE estado='Finalizada', finalizado_por=VALUES(finalizado_por), fecha_finalizacion=NOW()
        `, [req.params.modulo, idRegistro, req.solicitante.id_usuario]);
        await registrarBitacora(req.solicitante, 'FINALIZACION_REPORTERIA', `Finalizo ${fuente.label} #${idRegistro} desde Reporteria.`);
        return res.json({ message: 'Tarea finalizada correctamente.' });
    } catch (err) {
        console.error('Error finalizando tarea:', err);
        return res.status(500).json({ message: 'No se pudo finalizar la tarea.' });
    }
});

router.delete('/:modulo/:id', async (req, res) => {
    try {
        const fuente = FUENTES[req.params.modulo];
        const idRegistro = Number(req.params.id);
        if (!fuente || !idRegistro) return res.status(400).json({ message: 'Registro invalido.' });
        if (!fuente.eliminar) return res.status(405).json({ message: 'Este modulo es de solo lectura en Reporteria.' });
        if (req.params.modulo === 'usuarios' && idRegistro === req.solicitante.id_usuario) {
            return res.status(400).json({ message: 'No puede eliminar su propia sesion desde Reporteria.' });
        }

        const acceso = await autorizarRegistro(req.solicitante, fuente, idRegistro);
        if (!acceso.existe) return res.status(404).json({ message: 'Registro no encontrado.' });
        if (!acceso.autorizado) return res.status(403).json({ message: 'El registro pertenece a otro rol.' });

        await query(fuente.eliminar, [idRegistro]);
        await query('DELETE FROM reporteria_flujo WHERE modulo=? AND id_registro=?', [req.params.modulo, idRegistro]);
        await registrarBitacora(req.solicitante, 'ELIMINACION_REPORTERIA', `Elimino ${fuente.label} #${idRegistro} desde Reporteria.`);
        return res.json({ message: 'Registro eliminado correctamente.' });
    } catch (err) {
        console.error('Error eliminando desde reporteria:', err);
        const message = err.code === 'ER_ROW_IS_REFERENCED_2'
            ? 'El registro tiene informacion relacionada y no puede eliminarse.'
            : 'No se pudo eliminar el registro.';
        return res.status(500).json({ message });
    }
});

module.exports = router;
