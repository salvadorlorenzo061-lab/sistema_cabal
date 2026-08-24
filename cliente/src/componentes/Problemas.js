import { useState, useEffect, useCallback } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import PaginationBar from './PaginationBar';
import { normalizarLocalidadesJalapa } from '../data/localidadesJalapa';
import { agregarMembrete, escribirLineaMembrete } from '../utils/pdfMembrete';

function Problemas() {
  const MUNICIPIO_JALAPA_ID = 1;
  const MUNICIPIO_JALAPA_NOMBRE = 'Jalapa';

  // =========================================================================
  // 🔐 CONTROL DE USUARIO ACTIVO (Vincular con tu gestor de estados globales o login)
  // =========================================================================
  const sesionActiva = (() => {
    try {
      return JSON.parse(localStorage.getItem('sesion_cabal') || 'null');
    } catch (_) {
      return null;
    }
  })();

  const idUsuarioLogueado = Number(sesionActiva?.id_usuario) || 0;
  const nombreUsuarioLogueado = sesionActiva?.nombre || "SISTEMA";
  const rolUsuarioLogueado = sesionActiva?.rol || "Operador";

  // Estados de la entidad Problemas
  const [id_problema, setId_problema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [barrio_colonia, setBarrio_colonia] = useState("");
  const [id_municipio, setId_municipio] = useState(String(MUNICIPIO_JALAPA_ID));
  const [estado, setEstado] = useState("Pendiente"); 
  const [id_afiliado, setId_afiliado] = useState("");
  const [cocodeBusqueda, setCocodeBusqueda] = useState("");
  const [asignado_a, setAsignado_a] = useState("");
  const [foto, setFoto] = useState("");
  const [mostrarCargaFoto, setMostrarCargaFoto] = useState(false);
  const [cocodesList, setCocodesList] = useState([]);
  const [comunidadesJalapa, setComunidadesJalapa] = useState([]);
  const [usuariosAsignables, setUsuariosAsignables] = useState([]);

  // Listas para catálogos y grilla
  const [problemasList, setProblemasList] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  const API_URL = "https://sistema-cabal.onrender.com/api/problemas";
  const API_BASE_URL = API_URL.replace(/\/problemas$/, "");

  // =========================================================================
  // 📄 REPORTE PROFESIONAL: FICHA TÉCNICA DEL PROBLEMA REPORTADO
  // =========================================================================
  const descargarPDFIndividual = (val) => {
    const doc = new jsPDF();
    agregarMembrete(doc);

    // 🏢 ENCABEZADO INSTITUCIONAL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    escribirLineaMembrete(doc, "SISTEMA DE OBRAS MUNICIPALES JALAPA", 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    escribirLineaMembrete(doc, "Gestión Compartida y Reportes Comunitarios", 25);
    escribirLineaMembrete(doc, "Atención Ciudadana e Infraestructura Regional", 30);
    escribirLineaMembrete(doc, `Generado por: ${nombreUsuarioLogueado}`, 35);

    // 🔒 BLOQUE DE CONTROL
    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(231, 76, 60);  // Color rojo/alerta institucional para problemas
    doc.text("TICKET DE INCIDENCIA", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`${val.ticket_codigo || `TCK-${new Date(val.fecha_reporte).getFullYear()}-${String(val.id_problema).padStart(6, '0')}`}`, 133, 24); 
    
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

    let startYTable = 74;
    if (val.foto) {
      try {
        doc.addImage(val.foto, 'JPEG', 14, 74, 28, 28);
        startYTable = 106;
      } catch (e) {
        console.error("No se pudo renderizar la foto del ticket en PDF", e);
      }
    }

    // 📊 TABLA 1: DATOS ESTRUCTURADOS
    autoTable(doc, {
      startY: startYTable,
      head: [['PARÁMETRO', 'DETALLE EN BASE DE DATOS']],
      body: [
        ['ID ÚNICO DEL PROBLEMA', `#${val.id_problema}`],
        ['TÍTULO DE LA INCIDENCIA', val.titulo ? val.titulo.toUpperCase() : 'N/A'],
        ['DESCRIPCIÓN DETALLADA', val.descripcion || 'Sin descripción.'],
        ['BARRIO / COLONIA / COMUNIDAD', val.barrio_colonia ? val.barrio_colonia.toUpperCase() : 'N/A'],
        ['MUNICIPIO AFECTADO', val.nombre_municipio ? val.nombre_municipio.toUpperCase() : 'N/A'],
        ['FECHA DE REGISTRO', new Date(val.fecha_reporte).toLocaleString()],
        ['COCODE REPORTANTE', val.nombre_cocode ? `${val.nombre_cocode} (DPI: ${val.dpi_cocode || 'N/A'})` : (val.id_afiliado ? `ID #${val.id_afiliado}` : 'N/A')],
        ['ENCARGADO DE SOLUCIÓN', val.nombre_asignado || 'SIN ASIGNAR'],
        ['ESTADO OPERATIVO', val.estado ? val.estado.toUpperCase() : 'N/A'],
        ['EVIDENCIA FOTOGRÁFICA', val.foto ? 'ADJUNTA EN EL TICKET' : 'NO ADJUNTA'],
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
    if (!id_afiliado) {
      Swal.fire({ icon: 'warning', title: 'COCODE requerido', text: 'Teclee el DPI o nombre y seleccione un COCODE de la lista.' });
      return;
    }
    if (!asignado_a) {
      Swal.fire({ icon: 'warning', title: 'Encargado requerido', text: 'Seleccione quién dará solución al ticket.' });
      return;
    }

    Axios.post(`${API_URL}/crear`, { 
      titulo, 
      descripcion, 
      barrio_colonia, 
      id_municipio: MUNICIPIO_JALAPA_ID, 
      estado, 
      id_afiliado,
      asignado_a: Number(asignado_a),
      foto: foto || null,
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
    if (!id_afiliado) {
      Swal.fire({ icon: 'warning', title: 'COCODE requerido', text: 'Teclee el DPI o nombre y seleccione un COCODE de la lista.' });
      return;
    }
    if (!asignado_a) {
      Swal.fire({ icon: 'warning', title: 'Encargado requerido', text: 'Seleccione quién dará solución al ticket.' });
      return;
    }

    Axios.put(`${API_URL}/actualizar`, { 
      id_problema,
      titulo, 
      descripcion, 
      barrio_colonia, 
      id_municipio: MUNICIPIO_JALAPA_ID, 
      estado, 
      id_afiliado,
      asignado_a: Number(asignado_a),
      foto: foto || null,
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
    setId_municipio(String(MUNICIPIO_JALAPA_ID));
    setEstado("Pendiente"); 
    setId_afiliado("");
    setCocodeBusqueda("");
    setAsignado_a("");
    setFoto("");
    setMostrarCargaFoto(false);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'Archivo muy pesado', text: 'La imagen no debe superar los 2MB.' });
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setFoto(reader.result);
    reader.readAsDataURL(file);
  };

  const getProblemas = useCallback(() => {
    Axios.get(API_URL, { params: { pagina, limite: 10, id_usuario: idUsuarioLogueado, rol: rolUsuarioLogueado } })
    .then((response) => {
      const payload = response.data;
      const data = Array.isArray(payload) ? payload : (payload.data || []);
      setProblemasList(data);
      setPaginasTotales(Array.isArray(payload) ? 1 : (payload.paginasTotales || 1));
      setTotalRegistros(Array.isArray(payload) ? data.length : (payload.total || data.length));
    })
    .catch((error) => { console.error("Error al obtener problemas", error); });
  }, [API_URL, pagina, idUsuarioLogueado, rolUsuarioLogueado]);

  const getComunidadesJalapa = useCallback(() => {
    Axios.get(`${API_BASE_URL}/comunidades`, {
      params: {
        pagina: 1,
        limite: 500,
        id_departamento: 1,
        id_municipio: MUNICIPIO_JALAPA_ID
      }
    })
    .then((response) => {
      const payload = response.data;
      const data = Array.isArray(payload) ? payload : (payload.data || []);
      setComunidadesJalapa(data);
    })
    .catch((error) => { console.error("Error al obtener comunidades de Jalapa", error); });
  }, [API_BASE_URL]);

  const getCocodes = useCallback(() => {
    Axios.get(`${API_URL}/cocodes`, { params: { id_usuario: idUsuarioLogueado, rol: rolUsuarioLogueado } })
    .then((response) => {
      const payload = response.data;
      setCocodesList(Array.isArray(payload) ? payload : (payload.data || []));
    })
    .catch((error) => { console.error("Error al obtener cocodes", error); });
  }, [API_URL, idUsuarioLogueado, rolUsuarioLogueado]);

  const getUsuariosAsignables = useCallback(() => {
    Axios.get(`${API_URL}/usuarios-asignables`, { params: { id_usuario: idUsuarioLogueado } })
      .then((response) => setUsuariosAsignables(Array.isArray(response.data) ? response.data : []))
      .catch((error) => console.error("Error al obtener encargados", error));
  }, [API_URL, idUsuarioLogueado]);

  useEffect(() => { 
    getProblemas(); 
    getComunidadesJalapa();
    getCocodes();
    getUsuariosAsignables();
  }, [getProblemas, getComunidadesJalapa, getCocodes, getUsuariosAsignables]);

  const abrirEditarModal = (val) => {
    setId_problema(val.id_problema);
    setTitulo(val.titulo);
    setDescripcion(val.descripcion);
    setBarrio_colonia(val.barrio_colonia);
    setId_municipio(String(MUNICIPIO_JALAPA_ID));
    setEstado(val.estado || "Pendiente");
    setId_afiliado(val.id_afiliado || "");
    setCocodeBusqueda(
      val.id_afiliado
        ? `${val.dpi_cocode || ''} - ${val.nombre_cocode || `COCODE #${val.id_afiliado}`}`
        : ""
    );
    setAsignado_a(val.asignado_a ? String(val.asignado_a) : "");
    setFoto(val.foto || "");
    setMostrarCargaFoto(Boolean(val.foto));
    setShowEditModal(true);
  };

  const comunidadesOptions = (() => {
    const extras = comunidadesJalapa.map((item) => ({
      nombre: item.nombre_comunidad,
      tipo: item.tipo
    }));

    const normalizadas = normalizarLocalidadesJalapa(extras);
    const existeValorActual = normalizadas.some((item) => item.nombre === barrio_colonia.trim());

    if (barrio_colonia.trim() && !existeValorActual) {
      return [
        ...normalizadas,
        { nombre: barrio_colonia.trim(), tipo: 'actual', parent: '', searchText: barrio_colonia.trim().toLowerCase() }
      ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }

    return normalizadas;
  })();

  const seleccionarCocode = (valor) => {
    setCocodeBusqueda(valor);
    const normalizado = valor.trim().toLowerCase();
    const seleccionado = cocodesList.find((cocode) =>
      `${cocode.dpi} - ${cocode.nombre_completo}`.toLowerCase() === normalizado
    );
    setId_afiliado(seleccionado ? String(seleccionado.id_afiliado) : "");
  };

  const problemasFiltrados = problemasList.filter((prob) => 
    prob.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    prob.barrio_colonia?.toLowerCase().includes(busqueda.toLowerCase()) ||
    prob.nombre_municipio?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className='container-fluid mt-3 px-2 px-md-3'>
      
      {/* CABECERA DE LA PANTALLA */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm module-toolbar">
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

      <PaginationBar
        page={pagina}
        totalPages={paginasTotales}
        totalRecords={totalRegistros}
        onPrevious={() => setPagina((prev) => Math.max(prev - 1, 1))}
        onNext={() => setPagina((prev) => Math.min(prev + 1, paginasTotales))}
      />
      
      {/* TABLA DE DATOS */}
      <div className="table-responsive module-table-wrap">
        <table className="table table-striped table-bordered align-middle shadow-sm module-table-centered">
          <thead className="table-dark">
            <tr>
              <th>TICKET</th>
              <th>TÍTULO / ASUNTO</th>
              <th>UBICACIÓN (BARRIO Y MUNI)</th>
              <th>COCODE</th>
              <th>ENCARGADO</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {problemasFiltrados.length > 0 ? (
              problemasFiltrados.map((val) => (
                <tr key={val.id_problema}>
                  <th className="table-light">{val.ticket_codigo || `TCK-${new Date(val.fecha_reporte).getFullYear()}-${String(val.id_problema).padStart(6, '0')}`}</th>
                  <td>
                    <div className="fw-bold">{val.titulo}</div>
                    <small className="text-muted text-truncate d-inline-block" style={{maxWidth: "250px"}}>{val.descripcion}</small>
                  </td>
                  <td>
                    <strong>{val.barrio_colonia}</strong>, <span className="badge bg-secondary">{val.nombre_municipio || "No asignado"}</span>
                  </td>
                  <td>
                    <div className="fw-bold">{val.nombre_cocode || `COCODE #${val.id_afiliado}`}</div>
                    <small className="text-muted">DPI: {val.dpi_cocode || 'No disponible'}</small>
                  </td>
                  <td>
                    <strong>{val.nombre_asignado || 'Sin asignar'}</strong>
                  </td>
                  <td>
                    <span className={`badge bg-${
                      val.estado?.toLowerCase() === 'finalizado' ? 'success' :
                      val.estado?.toLowerCase() === 'trabajando' ? 'warning text-dark' :
                      val.estado?.toLowerCase() === 'seguimiento' ? 'info text-dark' :
                      val.estado?.toLowerCase() === 'activo' ? 'primary' : 'secondary'
                    }`}>
                      {val.estado ? val.estado.toUpperCase() : 'N/A'}
                    </span>
                  </td>
                  <td className="text-center">
                    <select
                      className="form-select form-select-sm fw-bold bg-light border-secondary module-action-select"
                      defaultValue=""
                      onChange={(e) => {
                        const accion = e.target.value;
                        if (!accion) return;

                        if (accion === 'actualizar') {
                          abrirEditarModal(val);
                        } else if (accion === 'eliminar') {
                          deleteProblema(val);
                        } else if (accion === 'pdf') {
                          descargarPDFIndividual(val);
                        }

                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>⚙️ Acciones</option>
                      <option value="actualizar">✏️ Actualizar</option>
                      <option value="eliminar">🗑️ Eliminar</option>
                      <option value="pdf">📄 PDF</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">No se encontraron problemas reportados.</td>
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
                    <label className="form-label fw-bold">Cocode Afectado:</label>
                    <input
                      type="text"
                      value={cocodeBusqueda}
                      onChange={(e) => seleccionarCocode(e.target.value)}
                      className="form-control"
                      list="cocodes-afectados-crear"
                      placeholder="Escriba DPI o nombre del COCODE"
                    />
                    <datalist id="cocodes-afectados-crear">
                      {cocodesList.map((coc) => (
                        <option key={coc.id_afiliado} value={`${coc.dpi} - ${coc.nombre_completo}`} />
                      ))}
                    </datalist>
                    <small className="text-muted">Teclee el DPI o nombre y seleccione una coincidencia.</small>
                  </div>
                </div>

                {id_afiliado && (
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">DPI del Cocode:</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cocodesList.find((c) => String(c.id_afiliado) === String(id_afiliado))?.dpi || ""}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Nombre del Cocode:</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cocodesList.find((c) => String(c.id_afiliado) === String(id_afiliado))?.nombre_completo || ""}
                        readOnly
                      />
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-bold">Descripción del Problema:</label>
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="form-control" rows="3" placeholder="Detalle la situación observada en la comunidad..."></textarea>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio, Colonia, Aldea o Caserio:</label>
                    <input
                      type="text"
                      value={barrio_colonia}
                      onChange={(e) => setBarrio_colonia(e.target.value)}
                      className="form-control"
                      list="localidades-jalapa-crear"
                      placeholder="Escriba para buscar y seleccionar una ubicacion"
                    />
                    <datalist id="localidades-jalapa-crear">
                      {comunidadesOptions.map((comunidad) => (
                        <option
                          key={`crear-${comunidad.nombre}`}
                          value={comunidad.nombre}
                          label={
                            `${comunidad.nombre}` +
                            `${comunidad.tipo && comunidad.tipo !== 'actual' ? ` (${comunidad.tipo})` : ''}` +
                            `${comunidad.parent ? ` - ${comunidad.parent}` : ''}`
                          }
                        />
                      ))}
                    </datalist>
                    <small className="text-muted">Empiece a escribir el nombre de la aldea, barrio, colonia, caserio o canton.</small>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio:</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select" disabled>
                      <option value={String(MUNICIPIO_JALAPA_ID)}>{MUNICIPIO_JALAPA_NOMBRE}</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Asignar solución a:</label>
                  <select value={asignado_a} onChange={(e) => setAsignado_a(e.target.value)} className="form-select">
                    <option value="">-- Seleccione encargado --</option>
                    {usuariosAsignables.map((usuario) => (
                      <option key={usuario.id_usuario} value={usuario.id_usuario}>
                        {usuario.nombre} - {usuario.rol}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">Solo el encargado seleccionado podrá resolver y finalizar el ticket.</small>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Estado Inicial del Ticket:</label>
                  <input value="Pendiente" className="form-control" readOnly />
                  <small className="text-muted">El encargado actualizará el resultado desde Reportería.</small>
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setMostrarCargaFoto((prev) => !prev)}
                  >
                    {mostrarCargaFoto ? 'Ocultar carga de fotografía' : 'Subir fotografía (opcional)'}
                  </button>
                </div>

                {mostrarCargaFoto && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Fotografía del Problema:</label>
                    <input type="file" accept="image/*" className="form-control" onChange={handleFotoChange} />
                    {foto && (
                      <img
                        src={foto}
                        alt="Evidencia del problema"
                        className="img-fluid mt-2 rounded border"
                        style={{ maxHeight: '180px', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                )}
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
                    <label className="form-label fw-bold">Cocode Afectado:</label>
                    <input
                      type="text"
                      value={cocodeBusqueda}
                      onChange={(e) => seleccionarCocode(e.target.value)}
                      className="form-control"
                      list="cocodes-afectados-editar"
                      placeholder="Escriba DPI o nombre del COCODE"
                    />
                    <datalist id="cocodes-afectados-editar">
                      {cocodesList.map((coc) => (
                        <option key={coc.id_afiliado} value={`${coc.dpi} - ${coc.nombre_completo}`} />
                      ))}
                    </datalist>
                    <small className="text-muted">Teclee el DPI o nombre y seleccione una coincidencia.</small>
                  </div>
                </div>

                {id_afiliado && (
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">DPI del Cocode:</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cocodesList.find((c) => String(c.id_afiliado) === String(id_afiliado))?.dpi || ""}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Nombre del Cocode:</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cocodesList.find((c) => String(c.id_afiliado) === String(id_afiliado))?.nombre_completo || ""}
                        readOnly
                      />
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-bold">Descripción del Problema:</label>
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="form-control" rows="3"></textarea>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio, Colonia, Aldea o Caserio:</label>
                    <input
                      type="text"
                      value={barrio_colonia}
                      onChange={(e) => setBarrio_colonia(e.target.value)}
                      className="form-control"
                      list="localidades-jalapa-editar"
                      placeholder="Escriba para buscar y seleccionar una ubicacion"
                    />
                    <datalist id="localidades-jalapa-editar">
                      {comunidadesOptions.map((comunidad) => (
                        <option
                          key={`editar-${comunidad.nombre}`}
                          value={comunidad.nombre}
                          label={
                            `${comunidad.nombre}` +
                            `${comunidad.tipo && comunidad.tipo !== 'actual' ? ` (${comunidad.tipo})` : ''}` +
                            `${comunidad.parent ? ` - ${comunidad.parent}` : ''}`
                          }
                        />
                      ))}
                    </datalist>
                    <small className="text-muted">Empiece a escribir el nombre de la aldea, barrio, colonia, caserio o canton.</small>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio:</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select" disabled>
                      <option value={String(MUNICIPIO_JALAPA_ID)}>{MUNICIPIO_JALAPA_NOMBRE}</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Asignar solución a:</label>
                  <select value={asignado_a} onChange={(e) => setAsignado_a(e.target.value)} className="form-select">
                    <option value="">-- Seleccione encargado --</option>
                    {usuariosAsignables.map((usuario) => (
                      <option key={usuario.id_usuario} value={usuario.id_usuario}>
                        {usuario.nombre} - {usuario.rol}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">El cambio de encargado se reflejará en Reportería.</small>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Estado del Ticket:</label>
                  <input value={estado || "Pendiente"} className="form-control" readOnly />
                  <small className="text-muted">El seguimiento y cierre se administran desde Reportería.</small>
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setMostrarCargaFoto((prev) => !prev)}
                  >
                    {mostrarCargaFoto ? 'Ocultar carga de fotografía' : 'Subir fotografía (opcional)'}
                  </button>
                </div>

                {mostrarCargaFoto && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Fotografía del Problema:</label>
                    <input type="file" accept="image/*" className="form-control" onChange={handleFotoChange} />
                    {foto && (
                      <img
                        src={foto}
                        alt="Evidencia del problema"
                        className="img-fluid mt-2 rounded border"
                        style={{ maxHeight: '180px', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                )}
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
