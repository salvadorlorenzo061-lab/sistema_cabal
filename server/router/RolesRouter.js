const express = require("express");
const db = require('../Conexion');
const router = express.Router();

// Crea la tabla si no existe y siembra roles base la primera vez
const initRolesTable = () => {
    db.query(`
        CREATE TABLE IF NOT EXISTS roles (
            id_rol INT AUTO_INCREMENT PRIMARY KEY,
            nombre_rol VARCHAR(100) NOT NULL UNIQUE,
            descripcion VARCHAR(255) DEFAULT NULL,
            estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
        )
    `, (err) => {
        if (err) { console.error("Error creando tabla roles:", err); return; }
        db.query(`
            INSERT IGNORE INTO roles (nombre_rol, descripcion, estado) VALUES
            ('Coordinador Regional',      'Nivel máximo de acceso al sistema',  'Activo'),
            ('Coordinador Municipal',     'Acceso a módulos de campo',           'Activo'),
            ('Sub Coordinador Municipal', 'Acceso básico de captura',            'Activo')
        `, (seedErr) => {
            if (seedErr) console.error("Error en seed de roles:", seedErr);
        });
    });
};
initRolesTable();

// GET / — listar roles
router.get("/", (_req, res) => {
    db.query("SELECT * FROM roles ORDER BY id_rol ASC", (err, result) => {
        if (err) { console.error(err); return res.status(500).send("Error al obtener roles"); }
        res.json(result);
    });
});

// POST /crear
router.post("/crear", (req, res) => {
    const { nombre_rol, descripcion, estado } = req.body;
    if (!nombre_rol?.trim()) return res.status(400).send("El nombre del rol es requerido");
    db.query(
        "INSERT INTO roles (nombre_rol, descripcion, estado) VALUES (?, ?, ?)",
        [nombre_rol.trim(), descripcion?.trim() || null, estado || 'Activo'],
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
    const { id_rol, nombre_rol, descripcion, estado } = req.body;
    if (!id_rol || !nombre_rol?.trim()) return res.status(400).send("Datos incompletos");
    db.query(
        "UPDATE roles SET nombre_rol=?, descripcion=?, estado=? WHERE id_rol=?",
        [nombre_rol.trim(), descripcion?.trim() || null, estado || 'Activo', id_rol],
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
