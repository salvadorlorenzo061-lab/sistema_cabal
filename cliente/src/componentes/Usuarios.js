import { useState, useEffect } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

function Usuarios() {
  const [id_usuario, setId_usuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [rol, setRol] = useState("");
  const [fecha_creacion, setFecha_creacion] = useState("");
  const [estado, setEstado] = useState("");
  
  const [usuariosList, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  // =========================================================================
  // 🌐 CONFIGURACIÓN DE URL DE PRODUCCIÓN EN LA NUBE (RENDER)
  // =========================================================================
  const BASE_URL = "https://sistema-cabal.onrender.com/api";
  const API_URL = `${BASE_URL}/usuarios`;

  // =========================================================================
  // 🔑 VARIABLES DE SESIÓN DINÁMICAS (Conexión directa con tu Auth global)
  // =========================================================================
  const [usuarioLogueado, setUsuarioLogueado] = useState("SISTEMA");
  const [miRol, setMiRol] = useState("");

  // Recuperar la sesión real de localStorage al cargar el componente
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesion_cabal');
    if (sesionGuardada) {
      const usuarioData = JSON.parse(sesionGuardada);
      setUsuarioLogueado(usuarioData.nombre || "Usuario Activo");
      setMiRol(usuarioData.rol || "");
    }
  }, []);

  // =========================================================================
  // 📄 REPORTE PROFESIONAL PDF INDIVIDUAL CON HISTORIAL DE AUDITORÍA
  // =========================================================================
  const descargarPDFIndividual = (val) => {
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("PARTIDO CABAL GUATEMALA", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Coordinación de TI y Organización Interna", 14, 25);
    doc.text("Sistema Centralizado de Afiliaciones e Incidencias (Izabal)", 14, 30);
    doc.text(`Generado por: Auditoría de Sistemas`, 14, 35);

    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);  
    doc.text("EXPEDIENTE INTEGRAL", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`ID REGISTRO: #${val.id_usuario}`, 133, 24); 
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Rol: ${val.rol ? val.rol.toUpperCase() : 'SIN ROL'}`, 133, 30);
    doc.text(`Fecha Ref: ${new Date().toLocaleDateString()}`, 133, 34);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42); 

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("DATOS GENERALES DEL COLABORADOR ", 14, 49);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Nombre Completo:   ${val.nombre ? val.nombre.toUpperCase() : ''}`, 14, 56);
    doc.text(`Correo Oficial:          ${val.correo || ''}`, 14, 61);
    doc.text(`Estado del Acceso:    ${val.estado ? val.estado.toUpperCase() : ''}`, 14, 66); 

    autoTable(doc, {
      startY: 72,
      head: [['PARÁMETRO DE SEGURIDAD', 'VALOR / CREDENCIAL ASIGNADA']],
      body: [
        ['CÓDIGO INTERNO DE USUARIO', `USR-${val.id_usuario}2026`],
        ['NOMBRE COMPLETO', val.nombre ? val.nombre.toUpperCase() : 'NO REGISTRADO'],
        ['CORREO ELECTRÓNICO DE ACCESO', val.correo || 'NO REGISTRADO'],
        ['CONTRASEÑA ENCRIPTADA (BD)', '••••••••'],
        ['ROL / NIVEL DE PERMISOS', val.rol ? val.rol.toUpperCase() : 'NO ASIGNADO'],
        ['FECHA CREACIÓN', val.fecha_creacion ? new Date(val.fecha_creacion).toLocaleDateString() : 'No registrada'],
        ['ESTADO OPERATIVO EN SISTEMA', val.estado ? val.estado.toUpperCase() : 'NO DEFINIDO'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9.5, halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65, textColor: [50, 50, 50] },
        1: { cellWidth: 117 }
      }
    });

    const filaAuditoriaReal = val.tipo_movimiento ? [
      val.fecha_movimiento ? new Date(val.fecha_movimiento).toLocaleString() : new Date().toLocaleString(),
      val.tipo_movimiento.toUpperCase(),
      val.ejecutado_por ? val.ejecutado_por.toUpperCase() : 'SISTEMA',
      val.detalles || 'Sin especificaciones detalladas en la consulta.'
    ] : [
      new Date().toLocaleString(),
      'SIN MOVIMIENTOS',
      'SISTEMA',
      'No se registran transacciones previas en auditoría para este perfil.'
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("BITÁCORA DE AUDITORÍA (ÚLTIMOS MOVIMIENTOS REALES)", 14, doc.lastAutoTable.finalY + 12);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['FECHA / HORA', 'ACCIÓN / EVENTO', 'EJECUTADO POR', 'DETALLES DE LA OPERACIÓN']],
      body: [filaAuditoriaReal],
      theme: 'grid',
      headStyles: { fillColor: [52, 73, 94], fontSize: 9, halign: 'center' }, 
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 35 },
        1: { fontStyle: 'bold', cellWidth: 45 },
        2: { halign: 'center', cellWidth: 30 },
        3: { cellWidth: 74 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Nota de seguridad: Esta ficha contiene trazas e historial de acceso de uso confidencial.", 14, finalY);
    doc.text("Partido Cabal - Control de Auditoría Interna de Sistemas de Información.", 14, finalY + 4);

    const nombreArchivo = val.nombre ? val.nombre.replace(/\s+/g, '_') : 'Usuario';
    doc.save(`Ficha_Auditoria_${nombreArchivo}.pdf`);
  };

  // =========================================================================
  // 💾 CONTROLADORES DE ACCIONES
  // =========================================================================
  const add = () => {
    const fechaEnvio = fecha_creacion.trim() || new Date().toISOString().split('T')[0];

    if (!nombre.trim() || !correo.trim() || !clave.trim() || !rol.trim() || !estado.trim()) {
      Swal.fire({
        position: "top-end",
        icon: "warning",
        title: 'DATOS INCOMPLETOS',
        showConfirmButton: false,
        timer: 3000
      });
      return; 
    }

    Axios.post(`${API_URL}/crear`, { 
      nombre, 
      correo, 
      clave, 
      rol, 
      fecha_creacion: fechaEnvio, 
      estado,
      ejecutado_por: usuarioLogueado 
    })
    .then(() => {
      getUsuarios();
      limpiarCampos();
      setShowRegModal(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: 'Usuario ' + nombre + ' creado correctamente',
        showConfirmButton: false,
        timer: 3000
      });
    })
    .catch((error) => {
      Swal.fire({
        title: "<strong>No se registró!</strong>",
        text: error.response?.data?.message || 'Hubo un error en el sistema',
        icon: 'warning',
        timer: 3000,
        showConfirmButton: false
      });
      console.error(error);
    });
  };

  const actualizar = () => {
    if (!nombre.trim() || !correo.trim() || !clave.trim() || !rol.trim() || !estado.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
      return;
    }

    Axios.put(`${API_URL}/actualizar`, { 
      id_usuario, 
      nombre, 
      correo, 
      clave, 
      rol, 
      fecha_creacion, 
      estado,
      ejecutado_por: usuarioLogueado 
    })
    .then(() => {
      getUsuarios();
      limpiarCampos();
      setShowEditModal(false);
      Swal.fire({
        html: '<strong>¡Éxito!</strong><p>Usuario actualizado correctamente</p>',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false
      });
    })
    .catch((error) => {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Error al actualizar' });
    });
  };

  const deteleUsuario = (val) => {
    Swal.fire({
      title: "Confirmar eliminación",
      html: '<i>¿Desea eliminar a <strong>' + val.nombre + '</strong>?</i>',
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminarlo!",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      if (result.isConfirmed) {
        const queryParams = `?operador=${encodeURIComponent(usuarioLogueado)}&rolOperador=${encodeURIComponent(miRol)}`;

        Axios.delete(`${API_URL}/delete/${val.id_usuario}${queryParams}`)
        .then(() => {
          getUsuarios();
          Swal.fire('¡Eliminado!', val.nombre + ' fue eliminado.', 'success');
        })
        .catch((error) => {
          console.error(error);
          const errorMsg = error.response?.data || 'No se pudo eliminar el registro';
          Swal.fire('Error de Permisos', errorMsg, 'error');
        });
      }
    });
  };

  const limpiarCampos = () => {
    setNombre(""); setCorreo(""); setClave(""); setRol(""); 
    setFecha_creacion(""); setEstado(""); setId_usuario("");
  };

  const getUsuarios = () => {
    Axios.get(API_URL)
    .then((response) => { setUsuarios(response.data); })
    .catch((error) => { console.error("Error al obtener usuarios", error); });
  };

  // ✅ CORRECCIÓN DE DEPRECIACIÓN DE DEPENDENCIAS: ESLint deshabilitado estratégicamente
  useEffect(() => { 
    getUsuarios(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirEditarModal = (val) => {
    setId_usuario(val.id_usuario);
    setNombre(val.nombre);
    setCorreo(val.correo);
    setClave(val.clave);
    setRol(val.rol);
    setFecha_creacion(val.fecha_creacion ? val.fecha_creacion.split('T')[0] : "");
    setEstado(val.estado);
    setShowEditModal(true);
  };

  const usuariosFiltrados = usuariosList.filter((user) => 
    user.nombre && user.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className='container mt-4'>
      {/* Encabezado Principal */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">GESTIÓN DE USUARIOS</h3>
        </div>
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-primary text-white">🔍</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por nombre del usuario..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button 
            className="btn btn-success fw-bold w-100" 
            onClick={() => { limpiarCampos(); setShowRegModal(true); }}
          >
            ➕ AGREGAR NUEVO USUARIO
          </button>
        </div>
      </div>
      
      {/* Tabla Desplegable */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>ID USUARIO</th>
              <th>NOMBRE</th>
              <th>CORREO</th>
              <th>CLAVE</th>
              <th>ROL</th>
              <th>FECHA CREACIÓN</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length > 0 ? (
              usuariosFiltrados.map((val) => (
                <tr key={val.id_usuario}>
                  <th className="table-light">{val.id_usuario}</th>
                  <td><strong>{val.nombre}</strong></td>
                  <td>{val.correo}</td>
                  <td><span className="text-muted">••••••••</span></td>
                  <td>
                    <span className={`badge ${val.rol === 'Coordinador Regional' ? 'bg-danger' : 'bg-primary'}`}>
                      {val.rol ? val.rol.toUpperCase() : 'SIN ROL'}
                    </span>
                  </td>
                  <td>{val.fecha_creacion ? new Date(val.fecha_creacion).toLocaleDateString() : 'No asignada'}</td>
                  <td>
                    <span className={`badge bg-${val.estado === 'activo' ? 'success' : val.estado === 'pendiente' ? 'warning text-dark' : 'danger'}`}>
                      {val.estado ? val.estado.toUpperCase() : 'DESCONOCIDO'}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex justify-content-center">
                      <button type="button" onClick={() => abrirEditarModal(val)} className="btn btn-info btn-sm mx-1 fw-bold">ACTUALIZAR</button>
                      
                      {miRol.trim().toLowerCase() !== "sub coordinador municipal" && (
                        <button type="button" onClick={() => deteleUsuario(val)} className="btn btn-danger btn-sm mx-1 fw-bold">ELIMINAR</button>
                      )}
                      
                      <button type="button" onClick={() => descargarPDFIndividual(val)} className="btn btn-secondary btn-sm mx-1 fw-bold">📄 PDF</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted py-3">No se encontraron usuarios coincidentes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1. MODAL REGISTRO */}
      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Registrar Usuario</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowRegModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre Completo:</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="form-control" placeholder="Ej: Juan Pérez" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Correo Electrónico:</label>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="form-control" placeholder="ejemplo@cabal.com" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Clave de Acceso:</label>
                  <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} className="form-control" placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Rol de Usuario:</label>
                  <select value={rol} onChange={(e) => setRol(e.target.value)} className="form-select">
                    <option value="" disabled>-- Seleccione un Rol --</option>
                    <option value="Coordinador Regional">Coordinador Regional</option>
                    <option value="Coordinador Municipal">Coordinador Municipal</option>
                    <option value="Sub Coordinador Municipal">Sub Coordinador Municipal</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado Inicial:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="" disabled>-- Seleccione un estado --</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRegModal(false); limpiarCampos(); }}>Cancelar</button>
                <button type="button" className="btn btn-success fw-bold" onClick={add}>Guardar Usuario</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL EDICIÓN */}
      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Actualizar Usuario #{id_usuario}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre Completo:</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Correo Electrónico:</label>
                  <input type="text" value={correo} onChange={(e) => setCorreo(e.target.value)} className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Cambiar Clave:</label>
                  <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Rol de Usuario:</label>
                  <select value={rol} onChange={(e) => setRol(e.target.value)} className="form-select">
                    <option value="Coordinador Regional">Coordinador Regional</option>
                    <option value="Coordinador Municipal">Coordinador Municipal</option>
                    <option value="Sub Coordinador Municipal">Sub Coordinador Municipal</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado del Acceso:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); limpiarCampos(); }}>Cancelar</button>
                <button type="button" className="btn btn-warning fw-bold" onClick={actualizar}>Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;