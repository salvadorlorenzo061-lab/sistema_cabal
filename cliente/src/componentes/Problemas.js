import { useState, useEffect } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

function Problemas() {
  // =========================================================================
  // 🔐 CONTROL DE USUARIO ACTIVO (Vincular con tu gestor de estados globales o login)
  // =========================================================================
  const idUsuarioLogueado = 3; 
  const nombreUsuarioLogueado = "Erick Hernandez";

  // Estados de la entidad Problemas
  const [id_problema, setId_problema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [barrio_colonia, setBarrio_colonia] = useState("");
  const [id_municipio, setId_municipio] = useState("");
  const [estado, setEstado] = useState("Pendiente"); 
  const [id_afiliado, setId_afiliado] = useState("");

  // Listas para catálogos y grilla
  const [problemasList, setProblemasList] = useState([]);
  const [municipiosList, setMunicipiosList] = useState([]); 
  const [busqueda, setBusqueda] = useState("");

  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  const API_URL = "http://localhost:3002/api/problemas";

  // =========================================================================
  // 📄 REPORTE PROFESIONAL: FICHA TÉCNICA DEL PROBLEMA REPORTADO
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
    doc.text("Gestión Compartida y Reportes Comunitarios", 14, 25);
    doc.text("Atención Ciudadana e Infraestructura Regional", 14, 30);
    doc.text(`Generado por: Auditoría de Sistemas`, 14, 35);

    // 🔒 BLOQUE DE CONTROL
    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(231, 76, 60);  // Color rojo/alerta institucional para problemas
    doc.text("REPORTE DE INCIDENCIA", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`ID REPORTADO: #${val.id_problema}`, 133, 24); 
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha Ref: ${new Date(val.fecha_reporte).toLocaleDateString()}`, 133, 32);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42); 

    // 👤 RESUMEN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("DETALLES GENERALES DEL PROBLEMA", 14, 49);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Título:               ${val.titulo ? val.titulo.toUpperCase() : 'S/N'}`, 14, 56);
    doc.text(`Ubicación:           ${val.barrio_colonia ? val.barrio_colonia.toUpperCase() : 'NO ESPECIFICADO'}, ${val.nombre_municipio ? val.nombre_municipio.toUpperCase() : 'N/A'}`, 14, 62);
    doc.text(`Estado Actual:       ${val.estado ? val.estado.toUpperCase() : ''}`, 14, 68); 

    // 📊 TABLA 1: DATOS ESTRUCTURADOS
    autoTable(doc, {
      startY: 74,
      head: [['PARÁMETRO', 'DETALLE EN BASE DE DATOS']],
      body: [
        ['ID ÚNICO DEL PROBLEMA', `#${val.id_problema}`],
        ['TÍTULO DE LA INCIDENCIA', val.titulo ? val.titulo.toUpperCase() : 'N/A'],
        ['DESCRIPCIÓN DETALLADA', val.descripcion || 'Sin descripción.'],
        ['BARRIO / COLONIA', val.barrio_colonia ? val.barrio_colonia.toUpperCase() : 'N/A'],
        ['MUNICIPIO AFECTADO', val.nombre_municipio ? val.nombre_municipio.toUpperCase() : 'N/A'],
        ['FECHA DE REGISTRO', new Date(val.fecha_reporte).toLocaleString()],
        ['ID AFILIADO REPORTANTE', val.id_afiliado ? `#${val.id_afiliado}` : 'N/A'],
        ['ESTADO OPERATIVO', val.estado ? val.estado.toUpperCase() : 'N/A'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [231, 76, 60], fontSize: 9.5, halign: 'left' },
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
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
    doc.text("Nota de seguridad: Esta ficha contiene datos de incidencias ciudadanas de uso interno.", 14, finalY);
    doc.text("Control de Auditoría Interna de Sistemas de Información.", 14, finalY + 4);

    doc.save(`Problema_${val.id_problema}_${val.titulo ? val.titulo.replace(/\s+/g, '_') : 'Incidencia'}.pdf`);
  };

  // =========================================================================
  //   CONTROLADORES DE BASE DE DATOS (CRUD + BITÁCORA)
  // =========================================================================
  const add = () => {
    if (!titulo.trim() || !descripcion.trim() || !barrio_colonia.trim() || !id_municipio || !id_afiliado) {
      Swal.fire({
        icon: "warning",
        title: 'DATOS INCOMPLETOS',
        text: 'Por favor, ingrese todos los campos requeridos para reportar el problema.',
        showConfirmButton: true
      });
      return; 
    }

    Axios.post(`${API_URL}/crear`, { 
      titulo, 
      descripcion, 
      barrio_colonia, 
      id_municipio, 
      estado, 
      id_afiliado,
      id_usuario_operador: idUsuarioLogueado,
      nombre_usuario_operador: nombreUsuarioLogueado
    })
    .then(() => {
      getProblemas();
      limpiarCampos();
      setShowRegModal(false);
      Swal.fire({
        icon: "success",
        title: '¡Registro Exitoso!',
        text: `El problema "${titulo}" se guardó en el sistema y bitácora de auditoría.`,
        showConfirmButton: false,
        timer: 3000
      });
    })
    .catch((error) => {
      Swal.fire({
        title: "No se pudo registrar",
        text: error.response?.data || 'Hubo un error en el servidor',
        icon: 'error'
      });
      console.error(error);
    });
  };

  const actualizar = () => {
    if (!id_problema || !titulo.trim() || !descripcion.trim() || !barrio_colonia.trim() || !id_municipio || !id_afiliado || !estado.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
      return;
    }

    Axios.put(`${API_URL}/actualizar`, { 
      id_problema,
      titulo, 
      descripcion, 
      barrio_colonia, 
      id_municipio, 
      estado, 
      id_afiliado,
      id_usuario_operador: idUsuarioLogueado,
      nombre_usuario_operador: nombreUsuarioLogueado
    })
    .then(() => {
      getProblemas();
      limpiarCampos();
      setShowEditModal(false);
      Swal.fire({
        title: '¡Éxito!',
        text: 'Problema actualizado correctamente y cambios guardados.',
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
        text: error.response?.data || 'No se pudo modificar el registro'
      });
    });
  };

  const deleteProblema = (val) => {
    Swal.fire({
      title: "Confirmar eliminación",
      html: `<i>¿Desea eliminar el problema: <strong>${val.titulo}</strong>? El evento se auditará en la bitácora.</i>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminarlo!",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      if (result.isConfirmed) {
        Axios.delete(`${API_URL}/delete/${val.id_problema}?id_usuario_operador=${idUsuarioLogueado}&nombre_usuario_operador=${nombreUsuarioLogueado}`)
        .then(() => {
          getProblemas();
          Swal.fire('¡Eliminado!', `El reporte fue removido con éxito.`, 'success');
        })
        .catch((error) => {
           console.error(error);
           Swal.fire('Error', 'No se pudo eliminar el problema', 'error');
        });
      }
    });
  };

  const limpiarCampos = () => {
    setId_problema("");
    setTitulo(""); 
    setDescripcion("");
    setBarrio_colonia("");
    setId_municipio("");
    setEstado("Pendiente"); 
    setId_afiliado("");
  };

  const getProblemas = () => {
    Axios.get(API_URL)
    .then((response) => { setProblemasList(response.data); })
    .catch((error) => { console.error("Error al obtener problemas", error); });
  };

  const getMunicipios = () => {
    Axios.get(`${API_URL}/municipios`)
    .then((response) => { setMunicipiosList(response.data); })
    .catch((error) => { console.error("Error al obtener municipios", error); });
  };

  useEffect(() => { 
    getProblemas(); 
    getMunicipios();
  }, []);

  const abrirEditarModal = (val) => {
    setId_problema(val.id_problema);
    setTitulo(val.titulo);
    setDescripcion(val.descripcion);
    setBarrio_colonia(val.barrio_colonia);
    setId_municipio(val.id_municipio || "");
    setEstado(val.estado || "Pendiente");
    setId_afiliado(val.id_afiliado || "");
    setShowEditModal(true);
  };

  const problemasFiltrados = problemasList.filter((prob) => 
    prob.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    prob.barrio_colonia?.toLowerCase().includes(busqueda.toLowerCase()) ||
    prob.nombre_municipio?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className='container mt-4'>
      
      {/* CABECERA DE LA PANTALLA */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">GESTIÓN DE PROBLEMAS</h3>
          <small className="text-muted">Operador activo: <strong>{nombreUsuarioLogueado}</strong></small>
        </div>
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-danger text-white">🔍</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por título, barrio o municipio..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button 
            className="btn btn-danger fw-bold w-100" 
            onClick={() => { limpiarCampos(); setShowRegModal(true); }}
          >
            ➕ REPORTAR PROBLEMA
          </button>
        </div>
      </div>
      
      {/* TABLA DE DATOS */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>TÍTULO / ASUNTO</th>
              <th>UBICACIÓN (BARRIO Y MUNI)</th>
              <th>AFILIADO</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {problemasFiltrados.length > 0 ? (
              problemasFiltrados.map((val) => (
                <tr key={val.id_problema}>
                  <th className="table-light">{val.id_problema}</th>
                  <td>
                    <div className="fw-bold">{val.titulo}</div>
                    <small className="text-muted text-truncate d-inline-block" style={{maxWidth: "250px"}}>{val.descripcion}</small>
                  </td>
                  <td>
                    <strong>{val.barrio_colonia}</strong>, <span className="badge bg-secondary">{val.nombre_municipio || "No asignado"}</span>
                  </td>
                  <td>#{val.id_afiliado}</td>
                  <td>
                    <span className={`badge bg-${val.estado?.toLowerCase() === 'resuelto' ? 'success' : val.estado?.toLowerCase() === 'en proceso' ? 'warning text-dark' : 'danger'}`}>
                      {val.estado ? val.estado.toUpperCase() : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex justify-content-center">
                      <button type="button" onClick={() => abrirEditarModal(val)} className="btn btn-info btn-sm mx-1 fw-bold text-white">ACTUALIZAR</button>
                      <button type="button" onClick={() => deleteProblema(val)} className="btn btn-danger btn-sm mx-1 fw-bold">ELIMINAR</button>
                      <button type="button" onClick={() => descargarPDFIndividual(val)} className="btn btn-secondary btn-sm mx-1 fw-bold">📄 PDF</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center text-muted py-3">No se encontraron problemas reportados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1. MODAL REGISTRO */}
      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">Registrar Incidencia / Problema</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowRegModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Título de la Incidencia:</label>
                    <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="form-control" placeholder="Ej: Fuga de Agua Potable" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">ID Afiliado Afectado:</label>
                    <input type="number" value={id_afiliado} onChange={(e) => setId_afiliado(e.target.value)} className="form-control" placeholder="Ej: 45" />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Descripción del Problema:</label>
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="form-control" rows="3" placeholder="Detalle la situación observada en la comunidad..."></textarea>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio o Colonia:</label>
                    <input type="text" value={barrio_colonia} onChange={(e) => setBarrio_colonia(e.target.value)} className="form-control" placeholder="Ej: Barrio El Porvenir" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio:</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select">
                      <option value="" disabled>-- Seleccione un Municipio --</option>
                      {municipiosList.map((muni) => (
                        <option key={muni.id_municipio} value={muni.id_municipio}>{muni.nombre_municipio}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Estado Inicial del Reporte:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Resuelto">Resuelto</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRegModal(false); limpiarCampos(); }}>Cancelar</button>
                <button type="button" className="btn btn-danger fw-bold" onClick={add}>Guardar Incidencia</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL EDICIÓN */}
      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Actualizar Incidencia #{id_problema}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Título de la Incidencia:</label>
                    <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="form-control" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">ID Afiliado:</label>
                    <input type="number" value={id_afiliado} onChange={(e) => setId_afiliado(e.target.value)} className="form-control" />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Descripción del Problema:</label>
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="form-control" rows="3"></textarea>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio o Colonia:</label>
                    <input type="text" value={barrio_colonia} onChange={(e) => setBarrio_colonia(e.target.value)} className="form-control" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio:</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select">
                      <option value="" disabled>-- Seleccione un Municipio --</option>
                      {municipiosList.map((muni) => (
                        <option key={muni.id_municipio} value={muni.id_municipio}>{muni.nombre_municipio}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Estado del Reporte:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Resuelto">Resuelto</option>
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

export default Problemas;