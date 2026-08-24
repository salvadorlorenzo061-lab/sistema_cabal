import { useCallback, useEffect, useState } from 'react';
import Axios from 'axios';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PaginationBar from './PaginationBar';
import { agregarMembrete, escribirLineaMembrete } from '../utils/pdfMembrete';

const MODULOS_OPERATIVOS = [
  { value: '', label: 'Todos los modulos' },
  { value: 'cocode', label: 'Incidente Cocode' },
  { value: 'problemas', label: 'Incidente COCODE' },
  { value: 'lideres', label: 'Lideres' },
  { value: 'propersonales', label: 'Incidentes personales' }
];

const obtenerSesion = () => {
  try {
    return JSON.parse(localStorage.getItem('sesion_cabal') || 'null');
  } catch (_) {
    return null;
  }
};

function Reporteria() {
  const sesion = obtenerSesion();
  const API_URL = 'https://sistema-cabal.onrender.com/api/reporteria';
  const esSupervisorGeneral = String(sesion?.rol || '').trim().toLowerCase() === 'supervisor general';
  const esAdministrador = String(sesion?.rol || '').trim().toLowerCase() === 'admin';
  const tieneAccesoGlobal = esAdministrador || esSupervisorGeneral;
  const modulosDisponibles = MODULOS_OPERATIVOS;

  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modulo, setModulo] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [usuariosAsignables, setUsuariosAsignables] = useState([]);
  const [ticketGestion, setTicketGestion] = useState(null);
  const [estadoGestion, setEstadoGestion] = useState('Pendiente');
  const [observacionGestion, setObservacionGestion] = useState('');
  const [ticketEditar, setTicketEditar] = useState(null);
  const [tituloEditar, setTituloEditar] = useState('');
  const [detalleEditar, setDetalleEditar] = useState('');

  const claseEstado = (estado) => {
    if (estado === 'Trabajado') return 'bg-success';
    if (estado === 'No trabajado') return 'bg-danger';
    return 'bg-warning text-dark';
  };

  const parametrosSesion = useCallback(() => ({
    id_usuario: Number(sesion?.id_usuario) || 0
  }), [sesion?.id_usuario]);

  const cargarRegistros = useCallback(() => {
    setCargando(true);
    Axios.get(API_URL, {
      params: {
        ...parametrosSesion(),
        pagina,
        limite: 10,
        busqueda: busqueda.trim() || undefined,
        modulo: modulo || undefined,
        estado: estadoFiltro || undefined,
        _: Date.now()
      }
    })
      .then((res) => {
        const payload = res.data || {};
        setRegistros(payload.data || []);
        setPaginasTotales(payload.paginasTotales || 1);
        setTotalRegistros(payload.total || 0);
      })
      .catch((error) => {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo cargar Reporteria',
          text: error.response?.data?.message || 'Error de conexion con el servidor.'
        });
      })
      .finally(() => setCargando(false));
  }, [API_URL, busqueda, estadoFiltro, modulo, pagina, parametrosSesion]);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  useEffect(() => {
    if (!tieneAccesoGlobal) return;
    Axios.get(`${API_URL}/usuarios-asignables/lista`, { params: parametrosSesion() })
      .then((res) => setUsuariosAsignables(Array.isArray(res.data) ? res.data : []))
      .catch((error) => console.error('No se pudieron cargar usuarios asignables:', error));
  }, [API_URL, tieneAccesoGlobal, parametrosSesion]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, estadoFiltro, modulo]);

  const abrirGestionTicket = (registro) => {
    setTicketGestion(registro);
    setEstadoGestion(['Pendiente', 'Trabajado', 'No trabajado'].includes(registro.estado_tarea)
      ? registro.estado_tarea
      : 'Pendiente');
    setObservacionGestion(registro.observacion || '');
  };

  const guardarGestionTicket = () => {
    if (!ticketGestion) return;
    const esResultadoFinal = estadoGestion === 'Trabajado' || estadoGestion === 'No trabajado';
    if (esResultadoFinal && !observacionGestion.trim()) {
      Swal.fire({ icon: 'warning', title: 'Observación requerida', text: 'Indique el resultado o motivo del cierre.' });
      return;
    }

    Axios.patch(`${API_URL}/${ticketGestion.modulo}/${ticketGestion.id_registro}/estado`, {
      ...parametrosSesion(),
      estado: estadoGestion,
      observacion: observacionGestion.trim()
    })
      .then(() => {
        setTicketGestion(null);
        cargarRegistros();
        Swal.fire({ icon: 'success', title: `Ticket ${estadoGestion}`, timer: 1800, showConfirmButton: false });
      })
      .catch((error) => Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el resultado',
        text: error.response?.data?.message || 'Error del servidor.'
      }));
  };

  const asignarTrabajo = (registro) => {
    const opciones = usuariosAsignables.reduce((resultado, usuario) => ({
      ...resultado,
      [usuario.id_usuario]: `${usuario.nombre} (${usuario.rol})`
    }), {});

    Swal.fire({
      title: 'Asignar trabajo',
      text: registro.titulo,
      input: 'select',
      inputOptions: opciones,
      inputPlaceholder: 'Seleccione un usuario',
      inputValue: registro.asignado_a || '',
      showCancelButton: true,
      confirmButtonText: 'Asignar',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => (!valor ? 'Seleccione un usuario.' : undefined)
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;
      Axios.patch(`${API_URL}/${registro.modulo}/${registro.id_registro}/asignar`, {
        ...parametrosSesion(),
        asignado_a: Number(resultado.value)
      })
        .then((res) => {
          cargarRegistros();
          Swal.fire({ icon: 'success', title: res.data?.message || 'Trabajo asignado', timer: 1800, showConfirmButton: false });
        })
        .catch((error) => Swal.fire({
          icon: 'error',
          title: 'No se pudo asignar',
          text: error.response?.data?.message || 'Error del servidor.'
        }));
    });
  };

  const abrirEdicion = (registro) => {
    setTicketEditar(registro);
    setTituloEditar(registro.titulo || '');
    setDetalleEditar(registro.detalle || '');
  };

  const guardarEdicion = () => {
    if (!ticketEditar || !tituloEditar.trim()) {
      Swal.fire({ icon: 'warning', title: 'Título requerido' });
      return;
    }

    Axios.put(`${API_URL}/${ticketEditar.modulo}/${ticketEditar.id_registro}`, {
      ...parametrosSesion(),
      titulo: tituloEditar.trim(),
      detalle: detalleEditar.trim()
    })
      .then(() => {
        setTicketEditar(null);
        cargarRegistros();
        Swal.fire({ icon: 'success', title: 'Registro actualizado', timer: 1800, showConfirmButton: false });
      })
      .catch((error) => Swal.fire({
        icon: 'error',
        title: 'No se pudo actualizar',
        text: error.response?.data?.message || 'Error del servidor.'
      }));
  };

  const eliminarTicket = (registro) => {
    Swal.fire({
      icon: 'warning',
      title: 'Eliminar registro',
      html: `Se eliminará <strong>${registro.titulo}</strong> del módulo ${registro.modulo_label}.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;
      Axios.delete(`${API_URL}/${registro.modulo}/${registro.id_registro}`, { params: parametrosSesion() })
        .then(() => {
          cargarRegistros();
          Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1800, showConfirmButton: false });
        })
        .catch((error) => Swal.fire({
          icon: 'error',
          title: 'No se pudo eliminar',
          text: error.response?.data?.message || 'Error del servidor.'
        }));
    });
  };

  const descargarPDF = (registro) => {
    const doc = new jsPDF();
    agregarMembrete(doc);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    escribirLineaMembrete(doc, 'SISTEMA DE OBRAS MUNICIPALES JALAPA', 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    escribirLineaMembrete(doc, 'REPORTE CONSOLIDADO DE ACTIVIDAD', 25);
    escribirLineaMembrete(doc, `Generado por: ${sesion?.nombre || 'Sistema'}`, 30);

    doc.setFillColor(245, 247, 250);
    doc.rect(130, 12, 66, 26, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);
    doc.text('FICHA DE REPORTERIA', 133, 18);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`${registro.modulo_label} #${registro.id_registro}`, 133, 24);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString(), 133, 32);
    doc.line(14, 42, 196, 42);

    autoTable(doc, {
      startY: 49,
      head: [['PARAMETRO', 'INFORMACION REGISTRADA']],
      body: [
        ['MODULO DE ORIGEN', registro.modulo_label],
        ['ID DEL REGISTRO', `#${registro.id_registro}`],
        ['TITULO / NOMBRE', registro.titulo || 'Sin titulo'],
        ['DETALLE', registro.detalle || 'Sin detalle'],
        ['ESTADO EN MODULO', registro.estado_origen || 'No definido'],
        ['ESTADO DE TAREA', registro.estado_tarea],
        ['OBSERVACIONES', registro.observacion || 'Sin observaciones'],
        ['ROL PROPIETARIO', registro.rol_propietario || 'Sin asignar'],
        ['REGISTRADO POR', registro.propietario || 'Sin asignar'],
        ['ASIGNADO A', registro.asignado_nombre || 'Sin asignar'],
        ['FECHA DE REGISTRO', registro.fecha_registro ? new Date(registro.fecha_registro).toLocaleString() : 'No disponible'],
        ['FECHA DE FINALIZACION', registro.fecha_finalizacion ? new Date(registro.fecha_finalizacion).toLocaleString() : 'Pendiente']
      ],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9.5 },
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 62 },
        1: { cellWidth: 119 }
      }
    });

    doc.save(`Reporteria_${registro.modulo}_${registro.id_registro}.pdf`);
  };

  return (
    <div className="container-fluid mt-3 px-2 px-md-3">
      <div className="row mb-3 align-items-center bg-light p-3 rounded shadow-sm module-toolbar">
        <div className="col-lg-3 mb-2 mb-lg-0">
          <h3 className="m-0 text-dark fw-bold">REPORTERIA</h3>
          <small className="text-muted">
            {tieneAccesoGlobal ? 'Vista global de todos los tickets' : 'Tickets a cargo de'}:
            {' '}<strong>{sesion?.nombre || 'Usuario'}</strong>
          </small>
        </div>
        <div className="col-lg-4 mb-2 mb-lg-0">
          <div className="input-group">
            <span className="input-group-text bg-primary text-white">Buscar</span>
            <input
              className="form-control"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, detalle, usuario o modulo..."
            />
          </div>
        </div>
        <div className="col-lg-2 mb-2 mb-lg-0">
          <select className="form-select" value={modulo} onChange={(event) => setModulo(event.target.value)}>
            {modulosDisponibles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="col-lg-3">
          <select className="form-select" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Trabajado">Trabajado</option>
            <option value="No trabajado">No trabajado</option>
          </select>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted small">{totalRegistros} registros disponibles</span>
        <button className="btn btn-outline-primary btn-sm" onClick={cargarRegistros} disabled={cargando}>
          {cargando ? 'Actualizando...' : 'Actualizar listado'}
        </button>
      </div>

      <PaginationBar
        page={pagina}
        totalPages={paginasTotales}
        totalRecords={totalRegistros}
        onPrevious={() => setPagina((actual) => Math.max(actual - 1, 1))}
        onNext={() => setPagina((actual) => Math.min(actual + 1, paginasTotales))}
      />

      <div className="table-responsive module-table-wrap">
        <table className="table table-striped table-bordered align-middle shadow-sm module-table-centered">
          <thead className="table-dark">
            <tr>
              <th>MODULO</th>
              <th>REGISTRO</th>
              <th>DETALLE</th>
              <th>CREADOR / ENCARGADO</th>
              <th>ESTADO</th>
              <th>FECHA</th>
              <th className="text-center">OPERACION</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && registros.length === 0 && (
              <tr><td colSpan="7" className="text-center text-muted py-4">No hay registros para este rol y filtros.</td></tr>
            )}
            {registros.map((registro) => (
              <tr key={`${registro.modulo}-${registro.id_registro}`}>
                <td><span className="badge bg-primary">{registro.modulo_label}</span></td>
                <td>
                  <strong className="d-block">{registro.titulo}</strong>
                  <small className="text-muted">ID #{registro.id_registro}</small>
                </td>
                <td style={{ minWidth: '220px', whiteSpace: 'normal' }}>{registro.detalle || 'Sin detalle'}</td>
                <td>
                  <strong className="d-block">Creado por: {registro.propietario || 'Sin responsable'}</strong>
                  {registro.asignado_nombre && (
                    <small className="d-block text-primary mt-1">Encargado: {registro.asignado_nombre}</small>
                  )}
                  {!registro.asignado_nombre && <small className="d-block text-muted mt-1">Sin asignar</small>}
                </td>
                <td>
                  <span className={`badge ${claseEstado(registro.estado_tarea)}`}>
                    {registro.estado_tarea}
                  </span>
                  <small className="d-block text-muted mt-1">Origen: {registro.estado_origen || 'N/D'}</small>
                  {registro.observacion && <small className="d-block mt-1" style={{ whiteSpace: 'normal' }}>{registro.observacion}</small>}
                </td>
                <td>{registro.fecha_registro ? new Date(registro.fecha_registro).toLocaleDateString() : 'N/D'}</td>
                <td className="text-center">
                  <select
                    className="form-select form-select-sm fw-bold module-action-select"
                    defaultValue=""
                    onChange={(event) => {
                      const accion = event.target.value;
                      if (accion === 'pdf') descargarPDF(registro);
                      if (accion === 'gestionar') abrirGestionTicket(registro);
                      if (accion === 'asignar') asignarTrabajo(registro);
                      if (accion === 'editar') abrirEdicion(registro);
                      if (accion === 'eliminar') eliminarTicket(registro);
                      event.target.value = '';
                    }}
                  >
                    <option value="" disabled>Acciones</option>
                    <option value="pdf">Descargar PDF</option>
                    {registro.puede_asignar && <option value="asignar">Asignar trabajo</option>}
                    <option value="gestionar" disabled={!registro.puede_gestionar}>Gestionar / finalizar ticket</option>
                    {esAdministrador && <option value="editar">Editar registro</option>}
                    {esAdministrador && <option value="eliminar">Eliminar registro</option>}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ticketGestion && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Gestionar ticket #{ticketGestion.id_registro}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setTicketGestion(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong className="d-block">{ticketGestion.titulo}</strong>
                  <small className="text-muted">Encargado: {ticketGestion.asignado_nombre || ticketGestion.propietario}</small>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Resultado del ticket:</label>
                  <select className="form-select" value={estadoGestion} onChange={(event) => setEstadoGestion(event.target.value)}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Trabajado">Trabajado</option>
                    <option value="No trabajado">No trabajado</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Observaciones:</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    value={observacionGestion}
                    onChange={(event) => setObservacionGestion(event.target.value)}
                    placeholder="Describa el trabajo realizado o el motivo por el que no se trabajó..."
                  ></textarea>
                  <small className="text-muted">Obligatoria para Trabajado y No trabajado.</small>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setTicketGestion(null)}>Cancelar</button>
                <button className="btn btn-primary fw-bold" onClick={guardarGestionTicket}>Guardar resultado</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ticketEditar && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Editar {ticketEditar.modulo_label} #{ticketEditar.id_registro}</h5>
                <button type="button" className="btn-close" onClick={() => setTicketEditar(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Título / nombre:</label>
                  <input className="form-control" value={tituloEditar} onChange={(event) => setTituloEditar(event.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Detalle principal:</label>
                  <textarea className="form-control" rows="5" value={detalleEditar} onChange={(event) => setDetalleEditar(event.target.value)}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setTicketEditar(null)}>Cancelar</button>
                <button className="btn btn-warning fw-bold" onClick={guardarEdicion}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Reporteria;
