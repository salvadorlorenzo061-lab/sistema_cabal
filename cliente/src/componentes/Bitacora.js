import { useState, useEffect, useCallback } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

function Bitacora() {
  const [bitacoraList, setBitacoraList] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  
  // Estados para la paginación del lado del servidor
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // URL del Backend actualizada para el entorno de producción
  const API_URL = "https://sistema-cabal.onrender.com/api/bitacora";

  // Cargar datos desde el backend usando los filtros estructurados
  const getBitacora = useCallback(() => {
    Axios.get(API_URL, {
      params: {
        busqueda: busqueda,
        tipo: tipoFiltro,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        pagina: pagina,
        limite: 10 // Mostrar los primeros 10 registros por página
      }
    })
    .then((response) => { 
      // Ajustamos la lectura ya que el backend ahora devuelve un objeto con metadata
      setBitacoraList(response.response?.data?.data || response.data.data || []);
      setPaginasTotales(response.data.paginasTotales || 1);
      setTotalRegistros(response.data.total || 0);
    })
    .catch((error) => { 
      console.error("Error al cargar la bitácora:", error); 
      Swal.fire({ icon: 'error', title: 'Error de conexión', text: 'No se pudo sincronizar la auditoría con el servidor.' });
    });
  }, [busqueda, tipoFiltro, fechaInicio, fechaFin, pagina]);

  // Ejecutar la consulta cada vez que cambien los filtros o la página
  useEffect(() => { 
    getBitacora(); 
  }, [getBitacora]);

  // Reiniciar a la página 1 si cambia un filtro de búsqueda
  const handleFiltroChange = (tipo, valor) => {
    setPagina(1);
    if (tipo === 'busqueda') setBusqueda(valor);
    if (tipo === 'tipo') setTipoFiltro(valor);
    if (tipo === 'inicio') setFechaInicio(valor);
    if (tipo === 'fin') setFechaFin(valor);
  };

  // Función dinámica para pintar Badges elegantes según la acción de procedencia
  const getBadgeClass = (tipo) => {
    if (!tipo) return 'bg-secondary';
    if (tipo.includes('ALTA') || tipo.includes('CREACION')) return 'bg-success text-white';
    if (tipo.includes('CAMBIO') || tipo.includes('ACTUALIZACION')) return 'bg-warning text-dark';
    if (tipo.includes('BAJA') || tipo.includes('ELIMINAR') || tipo.includes('DELETE')) return 'bg-danger text-white';
    return 'bg-primary text-white';
  };

  // =========================================================================
  // 📊 REPORTE IMPRESIÓN MAESTRA
  // =========================================================================
  const descargarInformeGeneral = () => {
    if (bitacoraList.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros en la vista actual para exportar.' });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PARTIDO CABAL GUATEMALA", 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("REPORTE MAESTRO DE AUDITORÍA Y BITÁCORA DE SISTEMAS", 14, 21);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()} | Región: Izabal | Vista: Página ${pagina}`, 14, 26);

    const dataTabla = bitacoraList.map((reg) => [
      reg.id_bitacora,
      reg.id_usuario ? `USR-${reg.id_usuario}` : "ELIMINADO",
      reg.nombre_usuario_afectado ? reg.nombre_usuario_afectado.toUpperCase() : "N/A o ELIMINADO",
      new Date(reg.fecha_movimiento).toLocaleString(),
      reg.tipo_movimiento ? reg.tipo_movimiento.toUpperCase() : "N/A",
      reg.ejecutado_por ? reg.ejecutado_por.toUpperCase() : "SISTEMA",
      reg.detalles
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['ID BITÁCORA', 'ID REF', 'USUARIO AFECTADO', 'FECHA / HORA', 'MOVIMIENTO', 'EJECUTADO POR', 'DETALLES DE LA OPERACIÓN']],
      body: dataTabla,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], fontSize: 9.5, halign: 'center' },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'center', cellWidth: 20 },
        2: { cellWidth: 45 },
        3: { halign: 'center', cellWidth: 40 },
        4: { fontStyle: 'bold', halign: 'center', cellWidth: 35 },
        5: { halign: 'center', cellWidth: 35 },
        6: { cellWidth: 75 }
      }
    });

    doc.save(`Informe_Auditoria_Pag_${pagina}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const descargarPDFIndividual = (reg) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138);
    doc.text("COMPROBANTE DE AUDITORÍA INTERNA", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Partido Cabal - Control de Seguridad Informática (Izabal)", 14, 25);

    doc.setFillColor(240, 244, 248);
    doc.rect(135, 12, 61, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(192, 57, 43); 
    doc.text(`REGISTRO ÚNICO: #${reg.id_bitacora}`, 139, 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`Tipo: ${reg.tipo_movimiento ? reg.tipo_movimiento.toUpperCase() : 'N/A'}`, 139, 24);

    doc.line(14, 38, 196, 38);

    autoTable(doc, {
      startY: 45,
      head: [['CONCEPTO DE SEGURIDAD', 'DETALLE REGISTRADO EN BASE DE DATOS']],
      body: [
        ['ID CORRELATIVO BITÁCORA', reg.id_bitacora],
        ['CÓDIGO USUARIO ASOCIADO', reg.id_usuario ? `USR-${reg.id_usuario}` : 'SIN CÓDIGO (ELIMINADO)'],
        ['NOMBRE USUARIO AFECTADO', reg.nombre_usuario_afectado ? reg.nombre_usuario_afectado.toUpperCase() : 'NO APLICA / ELIMINADO'],
        ['FECHA Y HORA DEL EVENTO', new Date(reg.fecha_movimiento).toLocaleString()],
        ['ACCIÓN / TIPO MOVIMIENTO', reg.tipo_movimiento ? reg.tipo_movimiento.toUpperCase() : 'N/A'],
        ['OPERADOR (EJECUTADO POR)', reg.ejecutado_por ? reg.ejecutado_por.toUpperCase() : 'SISTEMA'],
        ['DESCRIPCIÓN DE LA OPERACIÓN', reg.detalles],
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], fontSize: 10 },
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, textColor: [70, 70, 70] },
        1: { cellWidth: 122 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Este documento es una impresión fiel del registro inmutable de la base de datos de auditoría.", 14, finalY);
    doc.save(`Ticket_Auditoria_N_${reg.id_bitacora}.pdf`);
  };

  return (
    <div className='container mt-4'>
      
      {/* SECCIÓN DE CABECERA PRINCIPAL */}
      <div className="bg-dark p-3 rounded shadow-sm text-white mb-3">
        <div className="row align-items-center">
          <div className="col-md-7">
            <h3 className="m-0 fw-bold">🛡️ BITÁCORA DE AUDITORÍA</h3>
            <small className="text-white-50">
              Historial inmutable — Encontrados <strong>{totalRegistros} movimientos</strong> bajo los criterios actuales.
            </small>
          </div>
          <div className="col-md-5 text-end">
            <button className="btn btn-primary fw-bold" onClick={descargarInformeGeneral}>
              📊 EXPORTAR VISTA ACTUAL A PDF
            </button>
          </div>
        </div>
      </div>

      {/* 🛠 PANEL DE FILTROS AVANZADOS */}
      <div className="card p-3 mb-4 shadow-sm bg-light">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="small fw-bold text-secondary">Búsqueda General</label>
            <input 
              type="text" 
              className="form-control form-control-sm" 
              placeholder="Buscar operador, detalles o afectado..." 
              value={busqueda}
              onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="small fw-bold text-secondary">Tipo Acción</label>
            <select 
              className="form-select form-select-sm fw-bold text-dark"
              value={tipoFiltro}
              onChange={(e) => handleFiltroChange('tipo', e.target.value)}
            >
              <option value="">-- Todos --</option>
              <option value="ALTA_AFILIADO">ALTA AFILIADO</option>
              <option value="CAMBIO_AFILIADO">CAMBIO AFILIADO</option>
              <option value="BAJA_AFILIADO">BAJA AFILIADO</option>
              <option value="CREACION">CREACIÓN</option>
              <option value="ACTUALIZACION">ACTUALIZACIÓN</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="small fw-bold text-secondary">Desde</label>
            <input 
              type="date" 
              className="form-control form-control-sm"
              value={fechaInicio} 
              onChange={(e) => handleFiltroChange('inicio', e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="small fw-bold text-secondary">Hasta</label>
            <input 
              type="date" 
              className="form-control form-control-sm"
              value={fechaFin} 
              onChange={(e) => handleFiltroChange('fin', e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* TABLA DE RESULTADOS */}
      <div className="table-responsive shadow-sm rounded mb-3">
        <table className="table table-hover table-bordered align-middle m-0">
          <thead className="table-secondary text-center">
            <tr>
              <th style={{ width: '7%' }}>ID BIT.</th>
              <th style={{ width: '10%' }}>ID USUARIO</th>
              <th style={{ width: '18%' }}>AFECTADO / REGISTRO</th>
              <th style={{ width: '15%' }}>FECHA / HORA</th>
              <th style={{ width: '15%' }}>MOVIMIENTO</th>
              <th style={{ width: '12%' }}>EJECUTADO POR</th>
              <th style={{ width: '18%' }}>DETALLES</th>
              <th style={{ width: '5%' }}>FICHA</th>
            </tr>
          </thead>
          <tbody>
            {bitacoraList.length > 0 ? (
              bitacoraList.map((reg) => (
                <tr key={reg.id_bitacora}>
                  <th className="text-center table-light">{reg.id_bitacora}</th>
                  <td className="text-center text-muted">
                    {reg.id_usuario ? `#${reg.id_usuario}` : 'ELIMINADO'}
                  </td>
                  <td>
                    <strong>{reg.nombre_usuario_afectado ? reg.nombre_usuario_afectado.toUpperCase() : 'N/A o ELIMINADO'}</strong>
                  </td>
                  <td className="text-center small">
                    {new Date(reg.fecha_movimiento).toLocaleString()}
                  </td>
                  <td className="text-center">
                    <span className={`badge px-2 py-2 w-100 font-monospace small ${getBadgeClass(reg.tipo_movimiento)}`}>
                      {reg.tipo_movimiento ? reg.tipo_movimiento.toUpperCase() : 'N/A'}
                    </span>
                  </td>
                  <td className="text-center fw-bold text-secondary">
                    {reg.ejecutado_por ? reg.ejecutado_por.toUpperCase() : 'SISTEMA'}
                  </td>
                  <td className="small text-truncate" style={{ maxWidth: '240px' }} title={reg.detalles}>
                    {reg.detalles}
                  </td>
                  <td className="text-center">
                    <button 
                      type="button" 
                      onClick={() => descargarPDFIndividual(reg)} 
                      className="btn btn-outline-secondary btn-sm"
                      title="Descargar Comprobante único"
                    >
                      📄
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  No se registran actividades o incidencias que coincidan con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🏁 CONTROLES DE PAGINACIÓN */}
      {paginasTotales > 1 && (
        <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded shadow-sm">
          <button 
            className="btn btn-sm btn-outline-primary fw-bold" 
            disabled={pagina === 1}
            onClick={() => setPagina(prev => Math.max(prev - 1, 1))}
          >
            ◀ Anterior
          </button>
          <span className="small text-muted fw-bold">
            Página {pagina} de {paginasTotales}
          </span>
          <button 
            className="btn btn-sm btn-outline-primary fw-bold" 
            disabled={pagina === paginasTotales}
            onClick={() => setPagina(prev => Math.min(prev + 1, paginasTotales))}
          >
            Siguiente ▶
          </button>
        </div>
      )}
    </div>
  );
}

export default Bitacora;