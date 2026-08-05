import { useState, useEffect } from 'react';
import Axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import 'bootstrap/dist/css/bootstrap.min.css';

function Dashboard() {
  const [afiliados, setAfiliados] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [periodo, setPeriodo] = useState('todo');
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);

  const API_BASE = 'https://sistema-cabal.onrender.com/api';

  useEffect(() => {
    const normalizeList = (payload) => (Array.isArray(payload) ? payload : (payload?.data || []));

    Promise.allSettled([
      Axios.get(`${API_BASE}/afiliados`),
      Axios.get(`${API_BASE}/usuarios`),
      Axios.get(`${API_BASE}/problemas`),
      Axios.get(`${API_BASE}/comunidades`),
      Axios.get(`${API_BASE}/municipios`),
      Axios.get(`${API_BASE}/bitacora`)
    ])
      .then((results) => {
        const [afiliadosRes, usuariosRes, problemasRes, comunidadesRes, municipiosRes, bitacoraRes] = results;

        setAfiliados(afiliadosRes.status === 'fulfilled' ? normalizeList(afiliadosRes.value.data) : []);
        setUsuarios(usuariosRes.status === 'fulfilled' ? normalizeList(usuariosRes.value.data) : []);
        setProblemas(problemasRes.status === 'fulfilled' ? normalizeList(problemasRes.value.data) : []);
        setComunidades(comunidadesRes.status === 'fulfilled' ? normalizeList(comunidadesRes.value.data) : []);
        setMunicipios(municipiosRes.status === 'fulfilled' ? normalizeList(municipiosRes.value.data) : []);
        setBitacora(bitacoraRes.status === 'fulfilled' ? normalizeList(bitacoraRes.value.data) : []);
      })
      .catch((err) => {
        console.error('Error cargando dashboard:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setChartsReady(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  if (loading) {
    return (
      <div className="container-fluid mt-4 px-2 px-md-3 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Cargando métricas del sistema...</p>
      </div>
    );
  }

  // =========================================================================
  // 📊 PROCESAMIENTO DE DATOS EN TIEMPO REAL (FRONTEND)
  // =========================================================================
  const safeAfiliados = Array.isArray(afiliados) ? afiliados : [];
  const safeUsuarios = Array.isArray(usuarios) ? usuarios : [];
  const safeProblemas = Array.isArray(problemas) ? problemas : [];
  const safeComunidades = Array.isArray(comunidades) ? comunidades : [];
  const safeMunicipios = Array.isArray(municipios) ? municipios : [];
  const safeBitacora = Array.isArray(bitacora) ? bitacora : [];

  const inicioDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const hoy = new Date();
  const hoyInicio = inicioDelDia(hoy);
  const hoyFin = new Date(hoyInicio);
  hoyFin.setDate(hoyFin.getDate() + 1);

  const inicioSemana = new Date(hoyInicio);
  inicioSemana.setDate(hoyInicio.getDate() - hoyInicio.getDay());
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 7);

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

  const parseFecha = (valor) => {
    if (!valor) return null;
    const date = new Date(valor);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const obtenerFecha = (row, keys) => {
    for (const key of keys) {
      const date = parseFecha(row?.[key]);
      if (date) return date;
    }
    return null;
  };

  const filtrarPorPeriodo = (lista, keys) => {
    if (periodo === 'todo') return lista;

    return lista.filter((row) => {
      const fecha = obtenerFecha(row, keys);
      if (!fecha) return false;

      if (periodo === 'hoy') return fecha >= hoyInicio && fecha < hoyFin;
      if (periodo === 'semana') return fecha >= inicioSemana && fecha < finSemana;
      if (periodo === 'mes') return fecha >= inicioMes && fecha < finMes;
      return true;
    });
  };

  const afiliadosPeriodo = filtrarPorPeriodo(safeAfiliados, ['fecha_afiliacion', 'created_at', 'fecha_creacion']);
  const usuariosPeriodo = filtrarPorPeriodo(safeUsuarios, ['fecha_creacion', 'created_at']);
  const problemasPeriodo = filtrarPorPeriodo(safeProblemas, ['fecha_reporte', 'fecha_creacion', 'created_at']);
  const bitacoraPeriodo = filtrarPorPeriodo(safeBitacora, ['fecha_movimiento', 'created_at']);

  const etiquetaPeriodo = {
    todo: 'Todo el historial',
    hoy: 'Hoy',
    semana: 'Semana actual',
    mes: 'Mes actual'
  };
  
  // 1. Totalizadores rápidos
  const totalCocodes = afiliadosPeriodo.length;
  const totalUsuarios = usuariosPeriodo.length;
  const usuariosActivos = usuariosPeriodo.filter((u) => (u.estado || '').toLowerCase() === 'activo').length;
  const totalProblemas = problemasPeriodo.length;
  const problemasActivos = problemasPeriodo.filter((p) => {
    const estado = (p.estado || '').toLowerCase();
    return estado === 'pendiente' || estado === 'activo';
  }).length;
  const totalComunidades = safeComunidades.length;
  const totalMunicipiosCatalogo = safeMunicipios.length;
  const totalMovimientos = bitacoraPeriodo.length;

  const conNombreCocode = afiliadosPeriodo.filter(a => a.lugar_votacion && String(a.lugar_votacion).trim() !== '').length;
  
  // 2. Agrupación por Municipio para Gráfico de Barras
  const municipiosMap = {};
  afiliadosPeriodo.forEach(a => {
    const muni = a.nombre_municipio || "No Especificado";
    municipiosMap[muni] = (municipiosMap[muni] || 0) + 1;
  });
  const datosMunicipios = Object.keys(municipiosMap).map(key => ({
    name: key,
    Cantidad: municipiosMap[key]
  })).sort((a, b) => b.Cantidad - a.Cantidad).slice(0, 8);

  // 3. Agrupación por Fecha (Mes/Año) para Gráfico de Línea temporal
  const fechasMap = {};
  afiliadosPeriodo.forEach(a => {
    if (a.fecha_afiliacion) {
      const fecha = new Date(a.fecha_afiliacion);
      // Formato: "Año-Mes" (Ej: 2026-06)
      const mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      fechasMap[mesAnio] = (fechasMap[mesAnio] || 0) + 1;
    }
  });
  const datosLineaTiempo = Object.keys(fechasMap).sort().map(key => ({
    Fecha: key,
    Cocodes: fechasMap[key]
  }));

  // 4. Resumen por estado de problemas
  const problemasEstadoMap = {};
  problemasPeriodo.forEach((p) => {
    const estado = (p.estado || 'Sin estado').toString().toUpperCase();
    problemasEstadoMap[estado] = (problemasEstadoMap[estado] || 0) + 1;
  });
  const datosProblemasEstado = Object.keys(problemasEstadoMap).map((estado) => ({
    Estado: estado,
    Cantidad: problemasEstadoMap[estado]
  }));

  const ultimosMovimientos = [...bitacoraPeriodo].slice(0, 5);

  return (
    <div className="container-fluid mt-3 px-2 px-md-3 dashboard-shell">
      <div className="dashboard-header mb-3 mb-md-4">
        <h3 className="m-0 fw-bold">PANEL EJECUTIVO DEL SISTEMA</h3>
        <small>Visión consolidada de cocodes, incidencias, cobertura territorial y actividad operativa.</small>

        <div className="dashboard-period-filter mt-3">
          <button type="button" className={`btn btn-sm ${periodo === 'hoy' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setPeriodo('hoy')}>Hoy</button>
          <button type="button" className={`btn btn-sm ${periodo === 'semana' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setPeriodo('semana')}>Semana</button>
          <button type="button" className={`btn btn-sm ${periodo === 'mes' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setPeriodo('mes')}>Mes</button>
          <button type="button" className={`btn btn-sm ${periodo === 'todo' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setPeriodo('todo')}>Todo</button>
          <span className="dashboard-period-badge">Corte: {etiquetaPeriodo[periodo]}</span>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100 dashboard-kpi dashboard-kpi-primary">
            <div className="card-body">
              <h6>TOTAL COCODES</h6>
              <h2>{totalCocodes}</h2>
              <small>Registros totales del padrón</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100 dashboard-kpi dashboard-kpi-success">
            <div className="card-body">
              <h6>COCODES CON NOMBRE</h6>
              <h2>{conNombreCocode}</h2>
              <small>Con campo de nombre de cocode</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100 dashboard-kpi dashboard-kpi-warning">
            <div className="card-body">
              <h6>USUARIOS ACTIVOS</h6>
              <h2>{usuariosActivos}</h2>
              <small>{totalUsuarios} usuarios en total</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100 dashboard-kpi dashboard-kpi-danger">
            <div className="card-body">
              <h6>INCIDENCIAS ABIERTAS</h6>
              <h2>{problemasActivos}</h2>
              <small>{totalProblemas} problemas registrados</small>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">COCODES POR MUNICIPIO (TOP 8)</h5>
            <div style={{ width: '100%', height: 300, minWidth: 0 }}>
              {!chartsReady ? (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                  Preparando gráfico...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                  <BarChart data={datosMunicipios} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Cantidad" fill="#2980b9" radius={[4, 4, 0, 0]} name="No. Cocodes" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">RESUMEN OPERATIVO</h5>
            <ul className="dashboard-summary-list m-0 p-0">
              <li><span>Municipios catalogados</span><strong>{totalMunicipiosCatalogo}</strong></li>
              <li><span>Comunidades registradas</span><strong>{totalComunidades}</strong></li>
              <li><span>Movimientos en bitácora</span><strong>{totalMovimientos}</strong></li>
              <li><span>Cobertura municipal con cocodes</span><strong>{Object.keys(municipiosMap).length}</strong></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">TENDENCIA MENSUAL DE COCODES</h5>
            <div style={{ width: '100%', height: 300, minWidth: 0 }}>
              {!chartsReady ? (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                  Preparando gráfico...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                  <LineChart data={datosLineaTiempo} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Fecha" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Cocodes" stroke="#2ecc71" strokeWidth={3} activeDot={{ r: 7 }} name="Nuevos cocodes" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">INCIDENCIAS POR ESTADO</h5>
            <div style={{ width: '100%', height: 300, minWidth: 0 }}>
              {!chartsReady ? (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                  Preparando gráfico...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                  <BarChart data={datosProblemasEstado} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="Estado" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Cantidad" fill="#f39c12" radius={[4, 4, 0, 0]} name="No. Incidencias" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card shadow-sm border-0 p-3">
            <h5 className="card-title text-muted fw-bold mb-3">ÚLTIMOS MOVIMIENTOS EN BITÁCORA</h5>
            <div className="table-responsive module-table-wrap">
              <table className="table table-sm table-bordered align-middle mb-0 module-table-centered">
                <thead className="table-dark">
                  <tr>
                    <th>ID</th>
                    <th>FECHA</th>
                    <th>MOVIMIENTO</th>
                    <th>EJECUTADO POR</th>
                    <th>DETALLE</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosMovimientos.length > 0 ? ultimosMovimientos.map((row) => (
                    <tr key={row.id_bitacora || `${row.fecha_movimiento}-${row.tipo_movimiento}`}>
                      <td>{row.id_bitacora || '-'}</td>
                      <td>{row.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleString() : '-'}</td>
                      <td>{(row.tipo_movimiento || 'N/A').toUpperCase()}</td>
                      <td>{row.ejecutado_por || 'SISTEMA'}</td>
                      <td className="text-start">{row.detalles || 'Sin detalle'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-3">No hay movimientos disponibles.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;