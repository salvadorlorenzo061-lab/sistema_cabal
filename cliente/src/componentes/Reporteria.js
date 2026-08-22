import { useCallback, useEffect, useState } from 'react';
import Axios from 'axios';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PaginationBar from './PaginationBar';
import { agregarMembrete, escribirLineaMembrete } from '../utils/pdfMembrete';

const MODULOS = [
  { value: '', label: 'Todos los modulos' },
  { value: 'cocode', label: 'COCODE' },
  { value: 'problemas', label: 'Problemas' },
  { value: 'lideres', label: 'Lideres' },
  { value: 'propersonales', label: 'Problemas personales' }
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

  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modulo, setModulo] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [usuariosAsignables, setUsuariosAsignables] = useState([]);

  const claseEstado = (estado) => {
    if (estado === 'Finalizada') return 'bg-success';
    if (estado === 'Activo') return 'bg-primary';
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
        estado: estadoFiltro || undefined
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
    if (!esSupervisorGeneral) return;
    Axios.get(`${API_URL}/usuarios-asignables/lista`, { params: parametrosSesion() })
      .then((res) => setUsuariosAsignables(Array.isArray(res.data) ? res.data : []))
      .catch((error) => console.error('No se pudieron cargar usuarios asignables:', error));
  }, [API_URL, esSupervisorGeneral, parametrosSesion]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, estadoFiltro, modulo]);

  const cambiarEstado = (registro, estado) => {
    const requiereObservacion = estado === 'Finalizada';
    Swal.fire({
      icon: requiereObservacion ? 'question' : 'info',
      title: requiereObservacion ? 'Finalizar tarea' : `Marcar como ${estado}`,
      text: requiereObservacion ? `Indique el motivo para finalizar: ${registro.titulo}` : registro.titulo,
      input: requiereObservacion ? 'textarea' : undefined,
      inputLabel: requiereObservacion ? 'Observacion / motivo de finalizacion' : undefined,
      inputPlaceholder: requiereObservacion ? 'Describa por que se finaliza la tarea...' : undefined,
      inputValue: requiereObservacion ? (registro.observacion || '') : undefined,
      inputValidator: requiereObservacion ? (valor) => (!valor?.trim() ? 'La observacion es obligatoria.' : undefined) : undefined,
      showCancelButton: true,
      confirmButtonText: requiereObservacion ? 'Finalizar' : 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: requiereObservacion ? '#198754' : '#0d6efd'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;
      Axios.patch(`${API_URL}/${registro.modulo}/${registro.id_registro}/estado`, {
        ...parametrosSesion(),
        estado,
        observacion: requiereObservacion ? String(resultado.value || '').trim() : ''
      })
        .then(() => {
          cargarRegistros();
          Swal.fire({ icon: 'success', title: `Tarea en estado ${estado}`, timer: 1800, showConfirmButton: false });
        })
        .catch((error) => Swal.fire({
          icon: 'error',
          title: 'No se pudo cambiar el estado',
          text: error.response?.data?.message || 'Error del servidor.'
        }));
    });
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
        ['OBSERVACION DE CIERRE', registro.observacion || 'Sin observacion'],
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
        1: { cellWidth: 120 }
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
            {esSupervisorGeneral ? 'Vista general y asignacion de trabajo' : 'Registros propios y trabajo asignado'}:
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
            {MODULOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="col-lg-3">
          <select className="form-select" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Activo">Activo</option>
            <option value="Finalizada">Finalizada</option>
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
                      if (accion === 'pendiente') cambiarEstado(registro, 'Pendiente');
                      if (accion === 'activo') cambiarEstado(registro, 'Activo');
                      if (accion === 'finalizar') cambiarEstado(registro, 'Finalizada');
                      if (accion === 'asignar') asignarTrabajo(registro);
                      event.target.value = '';
                    }}
                  >
                    <option value="" disabled>Acciones</option>
                    <option value="pdf">Descargar PDF</option>
                    {esSupervisorGeneral && <option value="asignar">Asignar trabajo</option>}
                    <option value="pendiente" disabled={!registro.puede_gestionar || registro.estado_tarea === 'Pendiente'}>Marcar pendiente</option>
                    <option value="activo" disabled={!registro.puede_gestionar || registro.estado_tarea === 'Activo'}>Iniciar seguimiento</option>
                    <option value="finalizar" disabled={!registro.puede_gestionar || registro.estado_tarea === 'Finalizada'}>Finalizar ticket</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default Reporteria;
