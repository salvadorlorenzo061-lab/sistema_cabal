const express = require('express');
const cors = require('cors');
const db = require('./Conexion'); // Importación de la conexión a MySQL

// Inicialización de la aplicación Express
const app = express();

// =========================================================================
// 🛠️ MIDDLEWARES GLOBALES
// =========================================================================
app.use(cors());

// Configuración para aceptar payloads grandes (Base64, reportes, etc.)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =========================================================================
// 🔐 ENDPOINT DE LOGIN DIRECTO
// =========================================================================
app.post('/api/usuarios/login', (req, res) => {
    const { correo, clave } = req.body;

    if (!correo || !clave) {
        return res.status(400).json({ error: 'Por favor, ingrese el correo y la clave.' });
    }

    const sqlQuery = 'SELECT id_usuario, nombre, correo, rol, estado FROM usuarios WHERE correo = ? AND clave = ?';

    db.query(sqlQuery, [correo, clave], (err, result) => {
        if (err) {
            console.error("❌ Error en login:", err);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }

        if (result.length > 0) {
            const usuario = result[0];

            // Validar si el usuario está activo para permitirle entrar
            if (usuario.estado !== 'activo') {
                return res.status(403).json({ error: 'Tu usuario no está activo. Contacta al administrador.' });
            }

            return res.status(200).json({ success: true, usuario });
        } else {
            return res.status(401).json({ error: 'Correo electrónico o clave incorrectos.' });
        }
    });
});

// =========================================================================
// 📑 CARGA DE ENRUTADORES MODULARES (Carpeta router)
// =========================================================================
const municipiosRouter = require('./router/MunicipiosRouter');
const usuariosRouter = require('./router/UsuariosRouter');       
const comunidadesRouter = require('./router/ComunidadesRouter'); 
const departamentosRouter = require('./router/DepartamentosRouter');
const afiliadosRouter = require('./router/AfiliadosRouter');
const bitacoraRouter = require('./router/BitacoraRouter'); // 🛡️ Router de Auditoría
const problemasRouter = require('./router/ProblemasRouter'); // ⚠️ NUEVO: Router de Problemas Comunitarios

// Declarar los prefijos de la API global
app.use('/api/usuarios', usuariosRouter);                                      
app.use('/api/municipios', municipiosRouter);
app.use('/api/comunidades', comunidadesRouter); 
app.use('/api/departamentos', departamentosRouter);
app.use('/api/afiliados', afiliadosRouter); 
app.use('/api/bitacora', bitacoraRouter); // 🛡️ Endpoint de la bitácora asignado
app.use('/api/problemas', problemasRouter); // ⚠️ NUEVO: Prefijo asignado para problemas

// =========================================================================
// 🚀 ARRANQUE DEL SERVIDOR
// =========================================================================
app.listen(3002, () => {
    console.log("🚀 Servidor central corriendo perfectamente en el puerto 3002");
});