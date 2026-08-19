const express = require("express");
const db = require('../Conexion');
const router = express.Router();

const todosLosModulos = ['dashboard','usuarios','bitacora','comunidades','roles','cocode','problemas','lideres','propersonales'];
const esNombreRolLegacy = (nombreRol) => {
    const valor = String(nombreRol || '').trim().toLowerCase();
    return valor.includes('coordinador') || valor.includes('sub');
};

const initRolesTable = () => {
    db.query(`
        CREATE TABLE IF NOT EXISTS roles (
            id_rol INT AUTO_INCREMENT PRIMARY KEY,
            nombre_rol VARCHAR(100) NOT NULL UNIQUE,
            descripcion VARCHAR(255) DEFAULT NULL,
            estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
            permisos TEXT DEFAULT NULL
        )
    `, (err) => {
        if (err) { console.error("Error creando tabla roles:", err); return; }

        db.query("ALTER TABLE roles ADD COLUMN permisos TEXT DEFAULT NULL", (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error("Error añadiendo columna permisos:", alterErr);
            }
        });

        db.query(
            "DELETE FROM roles WHERE LOWER(nombre_rol) LIKE '%coordinador%' OR LOWER(nombre_rol) LIKE '%sub%'",
            (deleteErr) => {
                if (deleteErr) console.error("Error eliminando roles obsoletos:", deleteErr);
            }
        );

        db.query(
            "UPDATE usuarios SET rol = 'Usuario' WHERE LOWER(rol) LIKE '%coordinador%' OR LOWER(rol) LIKE '%sub%'",
            (updateErr) => {
                if (updateErr) console.error("Error sanitizando roles de usuarios:", updateErr);
            }
        );

        const permisosTotal = JSON.stringify(todosLosModulos);
        db.query(`
            INSERT IGNORE INTO roles (nombre_rol, descripcion, estado, permisos) VALUES
            ('Usuario', 'Acceso general al sistema', 'Activo', ?),
            ('Supervisor General', 'Consulta los registros de todos los usuarios', 'Activo', ?)
        `, [permisosTotal, permisosTotal], (seedErr) => {
            if (seedErr) console.error("Error en seed de roles:", seedErr);
        });
    });
};
initRolesTable();

// GET / — listar roles
router.get("/", (_req, res) => {
    db.query("SELECT * FROM roles WHERE NOT (LOWER(nombre_rol) LIKE '%coordinador%' OR LOWER(nombre_rol) LIKE '%sub%') ORDER BY id_rol ASC", (err, result) => {
        if (err) { console.error(err); return res.status(500).send("Error al obtener roles"); }
        res.json(result);
    });
});

// POST /crear
router.post("/crear", (req, res) => {
    const { nombre_rol, descripcion, estado, permisos } = req.body;
    if (!nombre_rol?.trim()) return res.status(400).send("El nombre del rol es requerido");
    const permisosJSON = Array.isArray(permisos) ? JSON.stringify(permisos) : (permisos || null);
    db.query(
        "INSERT INTO roles (nombre_rol, descripcion, estado, permisos) VALUES (?, ?, ?, ?)",
        [nombre_rol.trim(), descripcion?.trim() || null, estado || 'Activo', permisosJSON],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("Ya existe un rol con ese nombre");
                console.error(err);
                return res.status(500).send("Error al crear el rol");
            }
            res.status(200).send("Rol creado con éxito");
        }
    );
});

// PUT /actualizar
router.put("/actualizar", (req, res) => {
    const { id_rol, nombre_rol, descripcion, estado, permisos } = req.body;
    if (!id_rol || !nombre_rol?.trim()) return res.status(400).send("Datos incompletos");
    const permisosJSON = Array.isArray(permisos) ? JSON.stringify(permisos) : (permisos || null);
    db.query(
        "UPDATE roles SET nombre_rol=?, descripcion=?, estado=?, permisos=? WHERE id_rol=?",
        [nombre_rol.trim(), descripcion?.trim() || null, estado || 'Activo', permisosJSON, id_rol],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("Ya existe un rol con ese nombre");
                console.error(err);
                return res.status(500).send("Error al actualizar el rol");
            }
            res.status(200).send("Rol actualizado con éxito");
        }
    );
});

// DELETE /delete/:id_rol
router.delete("/delete/:id_rol", (req, res) => {
    const { id_rol } = req.params;
    db.query("DELETE FROM roles WHERE id_rol=?", [id_rol], (err, result) => {
        if (err) { console.error(err); return res.status(500).send("Error al eliminar el rol"); }
        if (result.affectedRows === 0) return res.status(404).send("Rol no encontrado");
        res.status(200).send("Rol eliminado con éxito");
    });
});

module.exports = router;
