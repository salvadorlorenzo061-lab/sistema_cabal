const express = require('express');
const cors = require('cors');

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
// 📑 CARGA DE ENRUTADORES MODULARES (Carpeta router)
// =========================================================================
const municipiosRouter = require('./router/MunicipiosRouter');
const usuariosRouter = require('./router/UsuariosRouter');       
const comunidadesRouter = require('./router/ComunidadesRouter'); 
const departamentosRouter = require('./router/DepartamentosRouter');
const afiliadosRouter = require('./router/AfiliadosRouter');
const bitacoraRouter = require('./router/BitacoraRouter'); // 🛡️ Router de Auditoría
const problemasRouter = require('./router/ProblemasRouter'); // ⚠️ Router de Problemas Comunitarios

// Declarar los prefijos de la API global
// 💡 Al usar '/api/usuarios', el endpoint de login se ejecutará automáticamente desde UsuariosRouter.js
app.use('/api/usuarios', usuariosRouter);                                      
app.use('/api/municipios', municipiosRouter);
app.use('/api/comunidades', comunidadesRouter); 
app.use('/api/departamentos', departamentosRouter);
app.use('/api/afiliados', afiliadosRouter); 
app.use('/api/bitacora', bitacoraRouter); 
app.use('/api/problemas', problemasRouter); 

// =========================================================================
// 🚀 ARRANQUE DEL SERVIDOR
// =========================================================================
// En Render el puerto se asigna dinámicamente mediante process.env.PORT
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Servidor central corriendo perfectamente en el puerto ${PORT}`);
});