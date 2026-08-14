const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./Conexion');

// Inicialización de la aplicación Express
const app = express();

// =========================================================================
// 🛠️ MIDDLEWARES GLOBALES
// =========================================================================
const allowlist = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://siom-pfycqtlz5-equipo5.vercel.app',
    'https://siom-56gju83n-equipo5.vercel.app',
    'https://sistema-cabal.vercel.app'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        const isAllowed = allowlist.includes(origin) || /(^|\.)vercel\.app$/i.test(origin);

        if (isAllowed) {
            callback(null, true);
            return;
        }

        callback(new Error('CORS no permitido para este origen'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
};

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowlist.includes(origin) || /(^|\.)vercel\.app$/i.test(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
    }
    next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Configuración para aceptar payloads grandes (Base64, reportes, etc.)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =========================================================================
// 📑 CARGA DE ENRUTADORES MODULARES (Carpeta router)
// =========================================================================
const municipiosRouter = require('./router/MunicipiosRouter');
const usuariosRouter = require('./router/UsuariosRouter');       
const comunidadesRouter = require('./router/ComunidadesRouter'); 
const departamentosRouter = require('./router/DepartamentosRouter');
const afiliadosRouter = require('./router/AfiliadosRouter');
const bitacoraRouter = require('./router/BitacoraRouter');
const problemasRouter = require('./router/ProblemasRouter');
const rolesRouter = require('./router/RolesRouter');
const liderRouter = require('./router/LiderRouter');
const properRouter = require('./router/ProperRouter');

app.use('/api/usuarios', usuariosRouter);
app.use('/api/municipios', municipiosRouter);
app.use('/api/comunidades', comunidadesRouter);
app.use('/api/departamentos', departamentosRouter);
app.use('/api/afiliados', afiliadosRouter);
app.use('/api/cocodes', afiliadosRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/bitacora', bitacoraRouter);
app.use('/api/problemas', problemasRouter);
app.use('/api/lideres', liderRouter);
app.use('/api/propersonales', properRouter);

// Health check para Render y verificación rápida de identidad del servicio
app.get('/health', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: process.env.SERVICE_NAME || 'sistema_cabal-api',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check de base de datos para validar conexión y nombre de esquema activo
app.get('/health/db', (_req, res) => {
    db.query('SELECT DATABASE() AS database_name, NOW() AS server_time', (err, rows) => {
        if (err) {
            return res.status(500).json({
                ok: false,
                service: process.env.SERVICE_NAME || 'sistema_cabal-api',
                dbConfigured: process.env.DB_NAME || 'defaultdb',
                error: err.code || err.message
            });
        }

        return res.status(200).json({
            ok: true,
            service: process.env.SERVICE_NAME || 'sistema_cabal-api',
            dbConfigured: process.env.DB_NAME || 'defaultdb',
            dbConnected: rows?.[0]?.database_name || null,
            serverTime: rows?.[0]?.server_time || null
        });
    });
});

// =========================================================================
// 🚀 ARRANQUE DEL SERVIDOR
// =========================================================================
// En Render el puerto se asigna dinámicamente mediante process.env.PORT
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Servidor central corriendo perfectamente en el puerto ${PORT}`);
});
