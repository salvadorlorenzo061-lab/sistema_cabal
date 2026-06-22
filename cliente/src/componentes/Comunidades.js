import { useState, useEffect } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

function Comunidades() {
  const [id_comunidad, setId_comunidad] = useState("");
  const [nombre_comunidad, setNombre_comunidad] = useState("");
  const [tipo, setTipo] = useState("aldea");
  const [estado, setEstado] = useState("activo"); 
  const [id_municipio, setId_municipio] = useState("");
  const [id_departamento, setId_departamento] = useState(""); 

  const [comunidadesList, setComunidades] = useState([]);
  const [municipiosList, setMunicipios] = useState([]);
  const [departamentosList, setDepartamentos] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  // Variables Mock de usuario (Vincúlalas al Contexto o Redux de tu sesión activa en el futuro)
  const USUARIO_ACTIVO_LOG = "OPERADOR IZABAL";
  const ID_USUARIO_LOG = 1;

  const API_URL = "http://localhost:3002/api/comunidades";

  // =========================================================================
  // 📄 REPORTE PROFESIONAL: FICHA DE COMUNIDAD
  // =========================================================================
  const descargarPDFIndividual = (val) => {
    const doc = new jsPDF();
    const dName = val.nombre_departamento ? val.nombre_departamento.toUpperCase() : "SIN ASIGNAR";
    const mName = val.nombre_municipio ? val.nombre_municipio.toUpperCase() : "SIN ASIGNAR";
    const cName = val.nombre_comunidad ? val.nombre_comunidad.toUpperCase() : "SIN NOMBRE";
    const tName = val.tipo ? val.tipo.toUpperCase() : "ALDEA";
    const eName = val.estado ? val.estado.toUpperCase() : "ACTIVO";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("SISTEMA CENTRAL CABAL", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Control y Catálogo Geográfico Regional", 14, 25);
    doc.text("Organización Territorial y Estructuras Locales", 14, 30);
    doc.text(`Generado por: Auditoría de Sistemas`, 14, 35);

    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);  
    doc.text("FICHA DE COMUNIDAD", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`ID REGISTRO: #${val.id_comunidad}`, 133, 24); 
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 133, 32);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42); 

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("UBICACIÓN EN LA ESTRUCTURA TERRITORIAL", 14, 49);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Departamento:      ${dName}`, 14, 56);
    doc.text(`Municipio:         ${mName}`, 14, 62);
    doc.text(`Comunidad (${tName}): ${cName}`, 14, 68); 

    autoTable(doc, {
      startY: 74,
      head: [['PARÁMETRO', 'DETALLE EN BASE DE DATOS']],
      body: [
        ['ID ÚNICO COMUNIDAD', `#${val.id_comunidad}`],
        ['DEPARTAMENTO', dName],
        ['MUNICIPIO ANFITRIÓN', mName],
        ['NOMBRE DE COMUNIDAD', cName],
        ['CLASIFICACIÓN GEOGRÁFICA', tName],
        ['ESTADO OPERATIVO', eName],
      ],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9.5, halign: 'left' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65, textColor: [50, 50, 50] },
        1: { cellWidth: 117 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Nota de seguridad: Esta ficha contiene datos de organización territorial confidenciales para uso interno.", 14, finalY);

    doc.save(`${tName}_${cName.replace(/\s+/g, '_')}.pdf`);
  };

  const getComunidades = () => {
    Axios.get(API_URL).then((res) => setComunidades(res.data)).catch(console.error);
  };

  const getCatalogos = () => {
    Axios.get("http://localhost:3002/api/municipios/departamentos").then((res) => setDepartamentos(res.data)).catch(console.error);
    Axios.get("http://localhost:3002/api/municipios").then((res) => setMunicipios(res.data)).catch(console.error);
  };

  useEffect(() => {
    getComunidades();
    getCatalogos();
  }, []);

  const add = () => {
    if (!nombre_comunidad.trim() || !id_municipio) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Escriba el nombre y elija el Municipio.' });
      return;
    }
    Axios.post(`${API_URL}/crear`, { 
      nombre_comunidad: nombre_comunidad.trim(), 
      tipo, 
      estado, 
      id_municipio: parseInt(id_municipio, 10),
      ejecutado_por: USUARIO_ACTIVO_LOG, // Pasados para el tracking automático
      id_usuario: ID_USUARIO_LOG
    })
    .then(() => {
      getComunidades();
      limpiarCampos();
      setShowRegModal(false);
      Swal.fire({ icon: 'success', title: 'Registrado correctamente', showConfirmButton: false, timer: 2000 });
    }).catch(err => {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Error del sistema' });
    });
  };

  const actualizar = () => {
    if (!nombre_comunidad.trim() || !id_municipio) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
      return;
    }
    Axios.put(`${API_URL}/actualizar`, { 
      id_comunidad: parseInt(id_comunidad, 10), 
      nombre_comunidad: nombre_comunidad.trim(), 
      tipo, 
      estado, 
      id_municipio: parseInt(id_municipio, 10),
      ejecutado_por: USUARIO_ACTIVO_LOG,
      id_usuario: ID_USUARIO_LOG
    })
    .then(() => {
      getComunidades();
      limpiarCampos();
      setShowEditModal(false);
      Swal.fire({ icon: 'success', title: 'Actualizado con éxito', showConfirmButton: false, timer: 2000 });
    }).catch(() => Swal.fire({ icon: 'error', title: 'Error al actualizar' }));
  };

  const deleteComunidad = (val) => {
    Swal.fire({
      title: "¿Eliminar registro?",
      html: `¿Desea borrar la comunidad <strong>${val.nombre_comunidad}</strong>?<br><small className="text-danger">Esta acción quedará registrada en auditoría.</small>`,
      icon: "warning",
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Pasamos el operador vía Query String para que el DELETE lo tome
        Axios.delete(`${API_URL}/delete/${val.id_comunidad}?ejecutado_por=${USUARIO_ACTIVO_LOG}&id_usuario=${ID_USUARIO_LOG}`)
        .then(() => {
          getComunidades();
          Swal.fire('Eliminado', 'Registro borrado con éxito.', 'success');
        }).catch(() => Swal.fire('Error', 'No se pudo eliminar', 'error'));
      }
    });
  };

  const limpiarCampos = () => {
    setId_comunidad("");
    setNombre_comunidad("");
    setTipo("aldea");
    setEstado("activo");
    setId_municipio("");
    setId_departamento("");
  };

  const abrirEditarModal = (val) => {
    setId_comunidad(val.id_comunidad);
    setNombre_comunidad(val.nombre_comunidad);
    setTipo(val.tipo);
    setEstado(val.estado);
    setId_departamento(val.id_departamento.toString()); 
    setId_municipio(val.id_municipio.toString()); 
    setShowEditModal(true);
  };

  const comunidadesFiltradas = comunidadesList.filter((com) => 
    com.nombre_comunidad.toLowerCase().includes(busqueda.toLowerCase()) ||
    com.nombre_municipio.toLowerCase().includes(busqueda.toLowerCase()) ||
    com.nombre_departamento.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className='container mt-4'>
      {/* CABECERA */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">ALDEAS Y CASERÍOS</h3>
        </div>
        <div className="col-md-5">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Buscar por aldea, municipio o departamento..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="col-md-3 text-end">
          <button className="btn btn-success fw-bold w-100" onClick={() => { limpiarCampos(); setShowRegModal(true); }}>
            ➕ AGREGAR LUGAR
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>DEPARTAMENTO</th>
              <th>MUNICIPIO</th>
              <th>NOMBRE LUGAR</th>
              <th>TIPO</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {comunidadesFiltradas.map((val) => (
              <tr key={val.id_comunidad}>
                <th>{val.id_comunidad}</th>
                <td>{val.nombre_departamento}</td>
                <td><strong>{val.nombre_municipio}</strong></td>
                <td>{val.nombre_comunidad}</td>
                <td><span className="badge bg-primary">{val.tipo.toUpperCase()}</span></td>
                <td>
                  <span className={`badge bg-${val.estado === 'activo' ? 'success' : 'danger'}`}>
                    {val.estado.toUpperCase()}
                  </span>
                </td>
                <td className="text-center">
                  <button onClick={() => abrirEditarModal(val)} className="btn btn-info btn-sm mx-1 fw-bold">EDITAR</button>
                  <button onClick={() => deleteComunidad(val)} className="btn btn-danger btn-sm mx-1 fw-bold">BORRAR</button>
                  <button onClick={() => descargarPDFIndividual(val)} className="btn btn-secondary btn-sm mx-1 fw-bold">📄 PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL REGISTRO */}
      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Registrar Comunidad Geográfica</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRegModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">1. Seleccione Departamento:</label>
                  <select value={id_departamento} onChange={(e) => { setId_departamento(e.target.value); setId_municipio(""); }} className="form-select">
                    <option value="">-- Elija un departamento --</option>
                    {departamentosList.map(dep => <option key={dep.id_departamento} value={dep.id_departamento}>{dep.nombre_departamento}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">2. Seleccione Municipio:</label>
                  <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select" disabled={!id_departamento}>
                    <option value="">-- Elija un municipio --</option>
                    {municipiosList.filter(m => String(m.id_departamento) === String(id_departamento)).map(muni => (
                      <option key={muni.id_municipio} value={muni.id_municipio}>{muni.nombre_municipio}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre de la Aldea/Caserío:</label>
                  <input type="text" value={nombre_comunidad} onChange={(e) => setNombre_comunidad(e.target.value)} className="form-control" placeholder="Ej: Sansirisay" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Tipo Geográfico:</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="form-select">
                    <option value="aldea">Aldea</option>
                    <option value="caserio">Caserío</option>
                    <option value="barrio">Barrio</option>
                    <option value="canton">Cantón</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado Inicial:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegModal(false)}>Cerrar</button>
                <button type="button" className="btn btn-success fw-bold" onClick={add}>Guardar Lugar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN (Optimizado el cambio de jerarquía) */}
      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Editar Ubicación #{id_comunidad}</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Departamento:</label>
                  {/* ⚡ CORREGIDO: Al cambiar el depto en edición, limpiamos el municipio para obligar a seleccionar uno válido de la nueva lista */}
                  <select value={id_departamento} onChange={(e) => { setId_departamento(e.target.value); setId_municipio(""); }} className="form-select">
                    <option value="">-- Elija un departamento --</option>
                    {departamentosList.map(dep => <option key={dep.id_departamento} value={dep.id_departamento}>{dep.nombre_departamento}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Municipio:</label>
                  <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select" disabled={!id_departamento}>
                    <option value="">-- Elija un municipio --</option>
                    {municipiosList.filter(m => String(m.id_departamento) === String(id_departamento)).map(muni => (
                      <option key={muni.id_municipio} value={muni.id_municipio}>{muni.nombre_municipio}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre:</label>
                  <input type="text" value={nombre_comunidad} onChange={(e) => setNombre_comunidad(e.target.value)} className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Tipo:</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="form-select">
                    <option value="aldea">Aldea</option>
                    <option value="caserio">Caserío</option>
                    <option value="barrio">Barrio</option>
                    <option value="canton">Cantón</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado Operativo:</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="form-select">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="button" className="btn btn-warning fw-bold" onClick={actualizar}>Actualizar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Comunidades;