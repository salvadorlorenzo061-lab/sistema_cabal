import { useState, useEffect } from 'react';
import Axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import 'bootstrap/dist/css/bootstrap.min.css';

function Dashboard() {
  const [afiliados, setAfiliados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Consumimos tu endpoint actual de afiliados
    Axios.get("https://sistema-cabal.onrender.com/api/afiliados")
      .then((res) => {
        const payload = res.data;
        setAfiliados(Array.isArray(payload) ? payload : (payload.data || []));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando estadísticas: ", err);
        setLoading(false);
      });
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
  
  // 1. Totalizadores rápidos
  const totalAfiliados = afiliados.length;
  
  const conCentroVotacion = afiliados.filter(a => a.lugar_votacion).length;
  
  // 2. Agrupación por Municipio para Gráfico de Barras
  const municipiosMap = {};
  afiliados.forEach(a => {
    const muni = a.nombre_municipio || "No Especificado";
    municipiosMap[muni] = (municipiosMap[muni] || 0) + 1;
  });
  const datosMunicipios = Object.keys(municipiosMap).map(key => ({
    name: key,
    Cantidad: municipiosMap[key]
  }));

  // 3. Agrupación por Fecha (Mes/Año) para Gráfico de Línea temporal
  const fechasMap = {};
  afiliados.forEach(a => {
    if (a.fecha_afiliacion) {
      const fecha = new Date(a.fecha_afiliacion);
      // Formato: "Año-Mes" (Ej: 2026-06)
      const mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      fechasMap[mesAnio] = (fechasMap[mesAnio] || 0) + 1;
    }
  });
  const datosLineaTiempo = Object.keys(fechasMap).sort().map(key => ({
    Fecha: key,
    Afiliados: fechasMap[key]
  }));

  return (
    <div className="container-fluid mt-3 px-2 px-md-3">
      <h3 className="mb-4 text-dark fw-bold">📊 DASHBOARD DE CONTROL -PARTIDO CABAL .</h3>

      {/* 📈 TARJETAS DE MÉTRICAS RÁPIDAS (KPIs) */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-primary text-white shadow-sm h-100">
            <div className="card-body d-flex flex-column justify-content-center py-4">
              <h6 className="text-uppercase fw-bold text-white-50">Total Afiliados</h6>
              <h2 className="display-5 fw-bold m-0">{totalAfiliados}</h2>
              <small className="mt-2 text-white-50">Registrados globalmente</small>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-success text-white shadow-sm h-100">
            <div className="card-body d-flex flex-column justify-content-center py-4">
              <h6 className="text-uppercase fw-bold text-white-50">Padrones Asignados</h6>
              <h2 className="display-5 fw-bold m-0">{conCentroVotacion}</h2>
              <small className="mt-2 text-white-50">Con centro de votación activo</small>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-warning text-dark shadow-sm h-100">
            <div className="card-body d-flex flex-column justify-content-center py-4">
              <h6 className="text-uppercase fw-bold text-black-50">Municipios Cobertura</h6>
              <h2 className="display-5 fw-bold m-0">{datosMunicipios.length}</h2>
              <small className="mt-2 text-black-50">Sectores con presencia</small>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 SECCIÓN DE GRÁFICOS */}
      <div className="row">
        
        {/* Gráfico de Barras: Municipios */}
        <div className="col-lg-6 mb-4">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">📍 Afiliados por Municipio</h5>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosMunicipios} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Cantidad" fill="#2980b9" radius={[4, 4, 0, 0]} name="No. Afiliados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gráfico de Línea: Historial Temporal */}
        <div className="col-lg-6 mb-4">
          <div className="card shadow-sm border-0 p-3 h-100">
            <h5 className="card-title text-muted fw-bold mb-3">📈 Tendencia Temporal de Afiliaciones</h5>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosLineaTiempo} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Fecha" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Afiliados" stroke="#2ecc71" strokeWidth={3} activeDot={{ r: 8 }} name="Nuevos Registros" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;