import { useState, useEffect } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import PaginationBar from './PaginationBar';

function Departamentos() {
  // =========================================================================
  // 🔐 CONTROL DE USUARIO ACTIVO
  // =========================================================================
  const idUsuarioLogueado = 3; // Ejemplo: Erick Hernandez
  const nombreUsuarioLogueado = "Erick Hernandez";

  // Estados para el formulario / control de Departamentos
  const [id_departamento, setId_departamento] = useState("");
  const [nombre_departamento, setNombre_departamento] = useState("");
  const [estado, setEstado] = useState("");

  // Listas de la Base de Datos
  const [departamentosList, setDepartamentosList] = useState([]); 
  
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  // 🌍 CORRECCIÓN: Se cambió 'localhost:3002' por la URL de producción para acceso móvil
  const API_URL = "https://sistema-cabal.onrender.com/api/departamentos";

  // =========================================================================
  // 📄 REPORTE PROFESIONAL: FICHA DE DEPARTAMENTO
  // =========================================================================
  const descargarPDFIndividual = (val) => {
    const doc = new jsPDF();

    // 🏢 ENCABEZADO INSTITUCIONAL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("SISTEMA CENTRAL CABAL", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Control y Catálogo Geográfico Regional", 14, 25);
    doc.text("Infraestructura y Cobertura de Operaciones", 14, 30);
    doc.text(`Generado por: Auditoría de Sistemas`, 14, 35);

    // 🔒 BLOQUE DE CONTROL
    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);  
    doc.text("REPORTE DE DEPARTAMENTO", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`ID REGISTRO: #${val.id_departamento}`, 133, 24); 
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha Ref: ${new Date().toLocaleDateString()}`, 133, 32);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42); 

    // 👤 RESUMEN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("DATOS GENERALES DE LA REGIÓN", 14, 49);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Departamento:         ${val.nombre_departamento ? val.nombre_departamento.toUpperCase() : 'NO ASIGNADO'}`, 14, 56);
    doc.text(`Estado de Operación:    ${val.estado ? val.estado.toUpperCase() : 'N/A'}`, 14, 62); 

    // 📊 TABLA 1: DATOS ESTRUCTURADOS
    autoTable(doc, {
      startY: 70,
      head: [['PARÁMETRO', 'DETALLE EN BASE DE DATOS']],
      body: [
        ['ID ÚNICO DEL DEPARTAMENTO', `#${val.id_departamento}`],
        ['DEPARTAMENTO', val.nombre_departamento ? val.nombre_departamento.toUpperCase() : 'N/A'],
        ['ESTADO OPERATIVO EN SISTEMA', val.estado ? val.estado.toUpperCase() : 'N/A'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9.5, halign: 'left' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65, textColor: [50, 50, 50] },
        1: { cellWidth: 117 }
      }
    });

    // 🔒 PIE DE PÁGINA
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Nota de seguridad: Esta ficha contiene datos geográficos de uso confidencial.", 14, finalY);
    doc.text("Control de Auditoría Interna de Sistemas de Información.", 14, finalY + 4);

    doc.save(`Departamento_${val.nombre_departamento.replace(/\s+/g, '_')}.pdf`);
  };

  // =========================================================================
  //   CONTROLADORES DE BASE DE DATOS (CRUD + BITÁCORA)
  // =========================================================================
  const add = () => {
    if (!nombre_departamento.trim() || !estado.trim()) {
      Swal.fire({
        icon: "warning",
        title: 'DATOS INCOMPLETOS',
        text: 'Por favor, ingrese todos los campos necesarios.',
      });
      return; 
    }

    Axios.post(`${API_URL}/crear`, { 
      nombre_departamento, 
      estado,
      id_usuario_operador: idUsuarioLogueado,
      nombre_usuario_operador: nombreUsuarioLogueado
    })
    .then(() => {
      getDepartamentos();
      limpiarCampos();
      setShowRegModal(false);
      Swal.fire({
        icon: "success",
        title: 'Departamento registrado',
        text: `El departamento "${nombre_departamento}" se registró correctamente en el sistema y bitácora.`,
        timer: 3000,
        showConfirmButton: false
      });
    })
    .catch((error) => {
      Swal.fire({
        title: "No se registró",
        text: error.response?.data?.message || 'Hubo un error en el sistema',
        icon: 'error'
      });
      console.error(error);
    });
  };

  const actualizar = () => {
    if (!nombre_departamento.trim() || !estado.trim() || !id_departamento) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
      return;
    }

    Axios.put(`${API_URL}/actualizar`, { 
      id_departamento, 
      nombre_departamento, 
      estado,
      id_usuario_operador: idUsuarioLogueado,
      nombre_usuario_operador: nombreUsuarioLogueado
    })
    .then(() => {
      getDepartamentos();
      limpiarCampos();
      setShowEditModal(false);
      Swal.fire({
        title: '¡Éxito!',
        text: 'Departamento actualizado y cambios guardados en bitácora',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false
      });
    })
    .catch((error) => {
      console.error(error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error al actualizar',
        text: error.response?.data?.message || 'Hubo un error en el sistema'
      });
    });
  };

  const deleteDepartamento = (val) => {
    Swal.fire({
      title: "Confirmar eliminación",
      html: `<i>¿Desea eliminar el departamento <strong>${val.nombre_departamento}</strong>? Esta acción se registrará en auditoría.</i>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminarlo!",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      if (result.isConfirmed) {
        Axios.delete(`${API_URL}/delete/${val.id_departamento}?id_usuario_operador=${idUsuarioLogueado}&nombre_usuario_operador=${nombreUsuarioLogueado}`)
        .then(() => {
          getDepartamentos();
          Swal.fire('¡Eliminado!', `${val.nombre_departamento} fue eliminado del sistema.`, 'success');
        })
        .catch((error) => {
           console.error(error);
           Swal.fire('Error', 'No se pudo eliminar el departamento', 'error');
        });
      }
    });
  };

  const limpiarCampos = () => {
    setId_departamento("");
    setNombre_departamento(""); 
    setEstado(""); 
  };

  const getDepartamentos = () => {
    Axios.get(API_URL, { params: { pagina, limite: 10 } })
    .then((response) => {
      const payload = response.data;
      const data = Array.isArray(payload) ? payload : (payload.data || []);
      setDepartamentosList(data);
      setPaginasTotales(Array.isArray(payload) ? 1 : (payload.paginasTotales || 1));
      setTotalRegistros(Array.isArray(payload) ? data.length : (payload.total || data.length));
    })
    .catch((error) => { console.error("Error al obtener departamentos", error); });
  };

  useEffect(() => { 
    getDepartamentos();
  }, [pagina]);

  const abrirEditarModal = (val) => {
    setId_departamento(val.id_departamento);
    setNombre_departamento(val.nombre_departamento);
    setEstado(val.estado || "activo");
    setShowEditModal(true);
  };

  const departamentosFiltrados = departamentosList.filter((dep) => 
    dep.nombre_departamento?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className='container-fluid mt-3 px-2 px-md-3'>
      
      {/* CABECERA DE LA PANTALLA */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">GESTIÓN DE DEPARTAMENTOS</h3>
          <small className="text-muted">Operador activo: <strong>{nombreUsuarioLogueado}</strong></small>
        </div>
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-primary text-white">🔍</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por departamento..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button 
            className="btn btn-success fw-bold w-100" 
            onClick={() => { limpiarCampos(); setEstado("activo"); setShowRegModal(true); }}
          >
            ➕ AGREGAR DEPARTAMENTO
          </button>
        </div>
      </div>

      <PaginationBar
        page={pagina}
        totalPages={paginasTotales}
        totalRecords={totalRegistros}
        onPrevious={() => setPagina((prev) => Math.max(prev - 1, 1))}
        onNext={() => setPagina((prev) => Math.min(prev + 1, paginasTotales))}
      />
      
      {/* TABLA DE DATOS */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>ID DEPARTAMENTO</th>
              <th>DEPARTAMENTO</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {departamentosFiltrados.length > 0 ? (
              departamentosFiltrados.map((val) => (
                <tr key={val.id_departamento}>
                  <th className="table-light">{val.id_departamento}</th>
                  <td><strong>{val.nombre_departamento}</strong></td>
                  <td>
                    <span className={`badge bg-${val.estado?.toLowerCase() === 'activo' ? 'success' : val.estado?.toLowerCase() === 'pendiente' ? 'warning text-dark' : 'danger'}`}>
                      {(val.estado || 'INACTIVO').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex justify-content-center">
                      <button type="button" onClick={() => abrirEditarModal(val)} className="btn btn-info btn-sm mx-1 fw-bold text-white">ACTUALIZAR</button>
                      <button type="button" onClick={() => deleteDepartamento(val)} className="btn btn-danger btn-sm mx-1 fw-bold">ELIMINAR</button>
                      <button type="button" onClick={() => descargarPDFIndividual(val)} className="btn btn-secondary btn-sm mx-1 fw-bold">📄 PDF</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted py-3">No se encontraron registros coincidentes.</td>
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
                <h5 className="modal-title fw-bold">Registrar Departamento</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowRegModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre del Departamento:</label>
                  <input type="text" value={nombre_departamento} onChange={(e) => setNombre_departamento(e.target.value)} className="form-control" placeholder="Ej: Guatemala" />
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
                <button type="button" className="btn btn-success fw-bold" onClick={add}>Guardar Departamento</button>
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
                <h5 className="modal-title fw-bold">Actualizar Departamento #{id_departamento}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre del Departamento:</label>
                  <input type="text" value={nombre_departamento} onChange={(e) => setNombre_departamento(e.target.value)} className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado:</label>
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

export default Departamentos;