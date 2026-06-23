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
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  // Estados de autenticación
  const [user, setUser] = useState(null);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Referencia para el control del temporizador de inactividad
  const timerRef = useRef(null);

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
    if (!user || !user.rol) return 5 * 60 * 1000; // 5 minutos por defecto

    const rol = user.rol.trim().toLowerCase();

    // ✨ Corregido: Se cambió 'role' por 'rol' para evitar el quiebre de la app
    switch (rol) {
      case 'coordinador regional':
        return 10 * 60 * 1000; // 10 minutos (tienen más carga de reportes)
      case 'coordinador municipal':
        return 5 * 60 * 1000;  // 5 minutos
      case 'sub coordinador municipal':
        return 5 * 60 * 1000;  // 5 minutos
      default:
        return 3 * 60 * 1000;  // 3 minutos para cualquier otro rol
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

  // 🔐 CONTROLADOR DE INICIO DE SESIÓN CORREGIDO (CONEXIÓN EN LA NUBE)
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');

    try {
      // Usamos el endpoint limpio apuntando directamente a tu UsuariosRouter en la nube
      const response = await fetch(`${USUARIOS_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, clave })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.usuario);
        localStorage.setItem('sesion_cabal', JSON.stringify(data.usuario));
      } else {
        setErrorLogin(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setErrorLogin('No hay conexión con el servidor central en la nube.');
    }
  };

  const miRol = user?.rol ? user.rol.trim().toLowerCase() : '';

  // 🚪 PANTALLA DE LOGIN
  if (!user) {
    return (
      <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center">
        <div className="card shadow p-4 border-0" style={{ maxWidth: '400px', width: '100%', borderRadius: '15px' }}>
          <div className="text-center mb-4">
            <img src={logoCabal} alt="Logo Partido Cabal" className="img-fluid p-2 bg-white rounded-circle shadow-sm mb-3" style={{ maxWidth: '100px' }} />
            <h4 className="fw-bold m-0" style={{ color: '#1e3a8a' }}>PARTIDO CABAL</h4>
            <small className="text-muted tracking-wider fw-bold">IZABAL - CONTROL CENTRAL</small>
          </div>

          {errorLogin && <div className="alert alert-danger py-2 text-center" style={{ fontSize: '0.85rem' }}>⚠️ {errorLogin}</div>}

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

  // 🏛️ INTERFAZ PRINCIPAL CON MENÚ LATERAL Y RUTAS PROTEGIDAS
  return (
    <Router>
      <div className="container-fluid"> 
        <div className="row">
          
          {/* BARRA LATERAL (SIDEBAR) */}
          <div 
            className={`p-3 shadow min-vh-100 transition-all ${isMenuOpen ? 'col-md-3 col-lg-2' : 'col-auto d-flex flex-column align-items-center'}`}
            style={{ transition: 'all 0.3s', backgroundColor: '#1e3a8a', color: '#ffffff' }}
          >
            <div className="text-center mb-4 mt-2">
              <img src={logoCabal} alt="Logo Partido Cabal" className="img-fluid rounded bg-white p-1 shadow-sm" style={{ maxWidth: isMenuOpen ? '110px' : '45px', transition: 'max-width 0.3s' }} />
              {isMenuOpen && (
                <div className="mt-2">
                  <span className="fw-bold tracking-wider text-white d-block" style={{ fontSize: '0.85rem' }}>PARTIDO CABAL</span>
                  <small className="text-white-50" style={{ fontSize: '0.7rem' }}>IZABAL</small>
                </div>
              )}
            </div>

            {isMenuOpen && (
              <div className="text-center rounded p-2 mb-3 shadow-sm border border-white-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                <span className="d-block text-white-50">Usuario Activo:</span>
                <strong className="text-white d-block text-truncate">{user.nombre.toUpperCase()}</strong>
                <span className="badge bg-light text-primary mt-1 fw-bold" style={{ fontSize: '0.65rem' }}>{user.rol.toUpperCase()}</span>
              </div>
            )}

            <button className="btn btn-light text-primary fw-bold mb-4 w-100 shadow-sm" onClick={toggleMenu}>
              {isMenuOpen ? '◀ Contraer' : '▶'}
            </button>

            {isMenuOpen && <h5 className="fw-bold mb-3 text-center text-white-50" style={{ fontSize: '0.9rem' }}>⚙️ MÓDULOS</h5>}

            <nav className="nav flex-column w-100 gap-2">
              
              {['coordinador regional'].includes(miRol) && (
                <Link to="/home" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>📊</span> {isMenuOpen && <span className="ms-2">Dashboard</span>}
                </Link>
              )}

              {['coordinador regional'].includes(miRol) && (
                <Link to="/usuarios" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>👥</span> {isMenuOpen && <span className="ms-2">Usuarios</span>}
                </Link>
              )}

              {['coordinador regional'].includes(miRol) && (
                <Link to="/bitacora" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>🛡️</span> {isMenuOpen && <span className="ms-2">Bitácora</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal'].includes(miRol) && (
                <>
                  <Link to="/municipios" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                    <span>📑</span> {isMenuOpen && <span className="ms-2">Municipios</span>}
                  </Link>

                  <Link to="/comunidades" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                    <span>📍</span> {isMenuOpen && <span className="ms-2">Aldeas / Caseríos</span>}
                  </Link>
                </>
              )}
              
              {['coordinador regional'].includes(miRol) && (
                <Link to="/departamentos" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>🏕</span> {isMenuOpen && <span className="ms-2">Departamentos</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal', 'sub coordinador municipal'].includes(miRol) && (
                <Link to="/afiliados" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>👨‍⚖️</span> {isMenuOpen && <span className="ms-2">Afiliados</span>}
                </Link>
              )}

              {['coordinador regional', 'coordinador municipal', 'sub coordinador municipal'].includes(miRol) && (
                <Link to="/problemas" className="nav-link btn btn-outline-light border-0 fw-bold p-2 text-start text-white d-flex align-items-center">
                  <span>⚠️</span> {isMenuOpen && <span className="ms-2">Problemas de Barrio</span>}
                </Link>
              )}

              <button onClick={handleLogout} className="mt-4 btn btn-danger border-0 fw-bold p-2 text-start d-flex align-items-center w-100 shadow-sm">
                <span>🚪</span> {isMenuOpen && <span className="ms-2">Cerrar Sesión</span>}
              </button>

            </nav>
          </div>

          {/* CONTENIDO PRINCIPAL */}
          <div className={`p-4 ${isMenuOpen ? 'col-md-9 col-lg-10' : 'col'}`}>
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