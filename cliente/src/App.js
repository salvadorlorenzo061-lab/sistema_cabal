import './App.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Importación de tus componentes existentes
import Usuarios from './componentes/Usuarios';
import Municipios from './componentes/Municipios';
import Comunidades from './componentes/Comunidades'; 
import Departamentos from './componentes/Departamentos';
import Afiliados from './componentes/Afiliados';
import Dashboard from './componentes/Dashboard'; 
import Bitacora from './componentes/Bitacora'; 
import Problemas from './componentes/Problemas'; 

// Imagen corporativa
import logoCabal from './img/1.png'; 

// =========================================================================
// 🛡️ COMPONENTE CONTROLADOR DE RUTAS POR ROL
// =========================================================================
const RutaProtegida = ({ user, rolesPermitidos, children }) => {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  const rolUsuario = user.rol ? user.rol.trim().toLowerCase() : '';
  
  if (!rolesPermitidos.includes(rolUsuario)) {
    if (rolUsuario === 'coordinador municipal' || rolUsuario === 'sub coordinador municipal') {
      return <Navigate to="/afiliados" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return children;
};

function App() {
  // Por defecto iniciamos con menú cerrado en móviles para mejorar la UX inicial
  const [isMenuOpen, setIsMenuOpen] = useState(window.innerWidth > 768);

  // Estados de autenticación
  const [user, setUser] = useState(null);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Referencia para el control del temporizador de inactividad
  const timerRef = useRef(null);

  // Ajustar el estado del menú automáticamente si cambia el tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsMenuOpen(false);
      } else {
        setIsMenuOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // =========================================================================
  // 🌐 CONFIGURACIÓN DE URL DE PRODUCCIÓN EN LA NUBE (RENDER)
  // =========================================================================
  const BASE_URL = "https://sistema-cabal.onrender.com/api";
  const USUARIOS_URL = `${BASE_URL}/usuarios`;

  // Carga inicial de sesión
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesion_cabal');
    if (sesionGuardada) {
      setUser(JSON.parse(sesionGuardada));
    }
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sesion_cabal');
    setCorreo('');      
    setClave('');        
    setErrorLogin('');   
  }, []);

  // 🕒 OBTENER TIEMPO LÍMITE SEGÚN EL ROL DEL USUARIO
  const obtenerTiempoLimite = useCallback(() => {
    if (!user || !user.rol) return 5 * 60 * 1000; 

    const rol = user.rol.trim().toLowerCase();

    switch (rol) {
      case 'coordinador regional':
        return 10 * 60 * 1000; 
      case 'coordinador municipal':
        return 5 * 60 * 1000;  
      case 'sub coordinador municipal':
        return 5 * 60 * 1000;  
      default:
        return 3 * 60 * 1000;  
    }
  }, [user]);

  // 🕒 FUNCIÓN DE EXPIRACIÓN POR INACTIVIDAD
  const verificarInactividad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!user) return;

    const tiempoLimite = obtenerTiempoLimite();

    timerRef.current = setTimeout(() => {
      handleLogout();
      Swal.fire({
        title: 'Sesión Expirada',
        text: `Tu sesión como ${user.rol.toUpperCase()} se ha cerrado automáticamente por inactividad para proteger los datos de control central.`,
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        confirmButtonText: 'Entrar de nuevo'
      });
    }, tiempoLimite);
  }, [user, handleLogout, obtenerTiempoLimite]);

  // 🕒 ESCUCHADOR DE INTERACCIONES DE TODOS LOS ROLES
  useEffect(() => {
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    if (user) {
      verificarInactividad();
      eventos.forEach(evento => window.addEventListener(evento, verificarInactividad));
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      eventos.forEach(evento => window.removeEventListener(evento, verificarInactividad));
    };
  }, [user, verificarInactividad]);

  // 🔐 CONTROLADOR DE INICIO DE SESIÓN
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');

    try {
      const response = await fetch(`${USUARIOS_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correo.toLowerCase().trim(), clave })
      });

      const data = await response.json();

      if (response.ok) {
        const usuarioValido = data.usuario ? data.usuario : (data.id_usuario ? data : null);

        if (usuarioValido) {
          setUser(usuarioValido);
          localStorage.setItem('sesion_cabal', JSON.stringify(usuarioValido));
          // Forzar apertura en escritorio tras loguearse exitosamente
          if (window.innerWidth > 768) setIsMenuOpen(true);
        } else {
          setErrorLogin('Estructura de usuario no reconocida por el servidor central.');
        }
      } else {
        setErrorLogin(data.message || data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error("Error en conexión Login:", err);
      setErrorLogin('No hay conexión con el servidor central en la nube.');
    }
  };

  const miRol = user?.rol ? user.rol.trim().toLowerCase() : '';

  // 🚪 PANTALLA DE LOGIN RESPONSIVA
  if (!user) {
    return (
      <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center p-3">
        <div className="card shadow p-4 border-0 w-100" style={{ maxWidth: '400px', borderRadius: '15px' }}>
          <div className="text-center mb-4">
            <img src={logoCabal} alt="Logo Partido Cabal" className="img-fluid p-2 bg-white rounded-circle shadow-sm mb-3" style={{ maxWidth: '95px' }} />
            <h4 className="fw-bold m-0" style={{ color: '#1e3a8a' }}>PARTIDO CABAL</h4>
            <small className="text-muted tracking-wider fw-bold d-block mt-1" style={{ fontSize: '0.75rem' }}>IZABAL - CONTROL CENTRAL</small>
          </div>

          {errorLogin && <div className="alert alert-danger py-2 text-center animate__animated animate__fadeIn" style={{ fontSize: '0.85rem' }}>⚠️ {errorLogin}</div>}

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold text-muted mb-1" style={{ fontSize: '0.8rem' }}>CORREO ELECTRÓNICO</label>
              <input 
                type="email" 
                className="form-control text-lowercase" 
                placeholder="ejemplo@cabal.com" 
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)} 
                autoComplete="off" 
                required 
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-bold text-muted mb-1" style={{ fontSize: '0.8rem' }}>CONTRASEÑA</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••" 
                value={clave} 
                onChange={(e) => setClave(e.target.value)} 
                autoComplete="new-password" 
                required 
              />
            </div>
            <button type="submit" className="btn w-100 fw-bold text-white shadow-sm p-2" style={{ backgroundColor: '#1e3a8a' }}>INGRESAR AL SISTEMA</button>
          </form>
        </div>
      </div>
    );
  }

  // 🏛️ INTERFAZ PRINCIPAL COMPLEMENTADA CON ESTRUCTURA MÓVIL (NAVBAR + SIDEBAR FLOTANTE)
  return (
    <Router>
      <div className="container-fluid p-0 overflow-hidden" style={{ minHeight: '100vh' }}>
        
        {/* 📱 NAVBAR SUPERIOR (SOLO EN PANTALLAS MÓVILES <= 768px) */}
        <div className="d-flex d-md-none bg-primary text-white justify-content-between align-items-center p-3 shadow-sm" style={{ backgroundColor: '#1e3a8a' }}>
          <div className="d-flex align-items-center gap-2">
            <img src={logoCabal} alt="Logo" className="bg-white p-1 rounded" style={{ maxWidth: '35px' }} />
            <span className="fw-bold tracking-wider" style={{ fontSize: '0.9rem' }}>CABAL IZABAL</span>
          </div>
          <button className="btn btn-outline-light px-3 py-1" onClick={toggleMenu}>
            {isMenuOpen ? '✕ Cerrar' : '☰ Menú'}
          </button>
        </div>

        <div className="row g-0 flex-nowrap" style={{ minHeight: '100vh' }}>
          
          {/* 🏢 BARRA LATERAL HÍBRIDA (Móviles: Flotante con Z-Index / Escritorio: Columna Estándar) */}
          <div 
            className={`shadow p-3 d-flex flex-column transition-all`}
            style={{ 
              backgroundColor: '#1e3a8a', 
              color: '#ffffff',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 1050,
              // Lógica Responsive Avanzada mediante JS en estilos
              position: window.innerWidth <= 768 ? 'fixed' : 'relative',
              left: window.innerWidth <= 768 && !isMenuOpen ? '-100%' : '0',
              top: 0,
              height: '100vh',
              width: window.innerWidth <= 768 ? '280px' : (isMenuOpen ? '260px' : '70px'),
              minWidth: window.innerWidth <= 768 ? '280px' : (isMenuOpen ? '260px' : '70px'),
            }}
          >
            {/* Cabecera del Menú (Oculta en versión icono de escritorio) */}
            <div className="text-center mb-4 mt-2">
              <img 
                src={logoCabal} 
                alt="Logo Partido Cabal" 
                className="img-fluid rounded bg-white p-1 shadow-sm" 
                style={{ 
                  maxWidth: (isMenuOpen || window.innerWidth <= 768) ? '100px' : '40px', 
                  transition: 'max-width 0.3s' 
                }} 
              />
              {(isMenuOpen || window.innerWidth <= 768) && (
                <div className="mt-2 animate__animated animate__fadeIn">
                  <span className="fw-bold tracking-wider text-white d-block" style={{ fontSize: '0.85rem' }}>PARTIDO CABAL</span>
                  <small className="text-white-50" style={{ fontSize: '0.7rem' }}>IZABAL</small>
                </div>
              )}
            </div>

            {/* Caja de Datos de Sesión Activa */}
            {(isMenuOpen || window.innerWidth <= 768) && (
              <div className="text-center rounded p-2 mb-3 shadow-sm border border-white-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                <span className="d-block text-white-50">Usuario Activo:</span>
                <strong className="text-white d-block text-truncate">{user.nombre.toUpperCase()}</strong>
                <span className="badge bg-light text-primary mt-1 fw-bold" style={{ fontSize: '0.65rem' }}>{user.rol.toUpperCase()}</span>
              </div>
            )}

            {/* Botón de contracción visible únicamente en Pantalla de Escritorio (Tablet/PC) */}
            <button className="btn btn-light text-primary fw-bold mb-4 w-100 shadow-sm d-none d-md-block" onClick={toggleMenu}>
              {isMenuOpen ? '◀ Contraer' : '▶'}
            </button>

            {(isMenuOpen || window.innerWidth <= 768) && <h5 className="fw-bold mb-2 text-white-50 px-2" style={{ fontSize: '0.8rem' }}>⚙️ MÓDULOS</h5>}

            {/* Navegación y Enlaces */}
            <nav className="nav flex-column w-100 gap-1 flex-grow-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              
              {['coordinador regional'].includes(miRol) && (
                <Link to="/home" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>📊</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Dashboard</span>}
                </Link>
              )}

              {['coordinador regional'].includes(miRol) && (
                <Link to="/usuarios" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>👥</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Usuarios</span>}
                </Link>
              )}

              {['coordinador regional'].includes(miRol) && (
                <Link to="/bitacora" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>🛡️</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Bitácora</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal'].includes(miRol) && (
                <>
                  <Link to="/municipios" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                    <span>📑</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Municipios</span>}
                  </Link>

                  <Link to="/comunidades" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                    <span>📍</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Aldeas / Caseríos</span>}
                  </Link>
                </>
              )}
              
              {['coordinador regional'].includes(miRol) && (
                <Link to="/departamentos" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>🏕</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Departamentos</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal', 'sub coordinador municipal'].includes(miRol) && (
                <Link to="/afiliados" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>👨‍⚖️</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Afiliados</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal', 'sub coordinador municipal'].includes(miRol) && (
                <Link to="/problemas" onClick={() => window.innerWidth <= 768 && setIsMenuOpen(false)} className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center rounded">
                  <span>⚠️</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Problemas de Barrio</span>}
                </Link>
              )}
            </nav>

            <button onClick={handleLogout} className="mt-auto btn btn-danger border-0 fw-bold p-2 text-start d-flex align-items-center w-100 shadow-sm rounded">
              <span>🚪</span> {(isMenuOpen || window.innerWidth <= 768) && <span className="ms-2">Cerrar Sesión</span>}
            </button>
          </div>

          {/* 🌫️ FONDO OSCURO COMPLEMENTARIO (Sólo móvil para cerrar el menú haciendo clic afuera) */}
          {window.innerWidth <= 768 && isMenuOpen && (
            <div 
              onClick={() => setIsMenuOpen(false)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1040 }}
            />
          )}

          {/* 📄 CONTENEDOR DEL CONTENIDO PRINCIPAL DINÁMICO */}
          <div 
            className="flex-grow-1 p-3 p-md-4" 
            style={{ 
              overflowY: 'auto', 
              maxHeight: '100vh',
              width: '100%',
              backgroundColor: '#f8f9fa'
            }}
          >
            <Routes>
              <Route path="/" element={
                (miRol === 'coordinador municipal' || miRol === 'sub coordinador municipal') 
                  ? <Navigate to="/afiliados" replace /> 
                  : <Navigate to="/home" replace />
              } />

              <Route path="/home" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional']}>
                  <Dashboard />
                </RutaProtegida>
              } />

              <Route path="/usuarios" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional']}>
                  <Usuarios />
                </RutaProtegida>
              } />

              <Route path="/bitacora" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional']}>
                  <Bitacora />
                </RutaProtegida>
              } />

              <Route path="/municipios" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional', 'coordinador municipal']}>
                  <Municipios />
                </RutaProtegida>
              } />
              
              <Route path="/comunidades" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional', 'coordinador municipal']}>
                  <Comunidades />
                </RutaProtegida>
              } />
              
              <Route path="/departamentos" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional']}>
                  <Departamentos />
                </RutaProtegida>
              } />

              <Route path="/afiliados" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional', 'coordinador municipal', 'sub coordinador municipal']}>
                  <Afiliados />
                </RutaProtegida>
              } />

              <Route path="/problemas" element={
                <RutaProtegida user={user} rolesPermitidos={['coordinador regional', 'coordinador municipal', 'sub coordinador municipal']}>
                  <Problemas />
                </RutaProtegida>
              } />

              <Route path="*" element={
                <Navigate to={(miRol === 'coordinador municipal' || miRol === 'sub coordinador municipal') ? "/afiliados" : "/home"} replace />
              } />
            </Routes>
          </div>

        </div>
      </div>
    </Router>
  );
}

export default App;