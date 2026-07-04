import { useState, useEffect, useCallback } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import * as XLSX from 'xlsx';
import PaginationBar from './PaginationBar';

function Afiliados() {
  // =========================================================================
  // 🔐 CONTROL DE SESIÓN (Enlazado dinámicamente)
  // =========================================================================
  const usuarioLogueado = {
    id_usuario: 3, 
    nombre: "Erick Hernandez", 
    rol: "Coordinador Regional"
  };

  const [id_afiliado, setId_afiliado] = useState("");
  const [dpi, setDpi] = useState("");
  const [nombre_completo, setNombre_completo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio_colonia, setBarrio_colonia] = useState("");
  const [id_municipio, setId_municipio] = useState("");
  const [fecha_afiliacion, setFecha_afiliacion] = useState("");
  const [id_usuario, setId_usuario] = useState("");
  const [foto, setFoto] = useState(""); 
  
  const [num_empadronamiento, setNum_empadronamiento] = useState("");
  const [lugar_votacion, setLugar_votacion] = useState("");

  const [afiliadosList, setAfiliados] = useState([]);
  const [municipiosList, setMunicipios] = useState([]);
  const [usuariosList, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  const [showRegModal, setShowRegModal] = useState(false);  
  const [showEditModal, setShowEditModal] = useState(false); 

  // 🌐 URL ACTUALIZADA A PRODUCCIÓN EN RENDER
  const BASE_URL = "https://sistema-cabal.onrender.com/api";
  const API_URL = `${BASE_URL}/afiliados`;

  // Lectura correcta de ficheros locales a strings Base64
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Límite preventivo de 2MB en cliente
        Swal.fire({ icon: 'error', title: 'Archivo muy pesado', text: 'La imagen no debe superar los 2MB.' });
        e.target.value = null;
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto(reader.result); 
      };
      reader.readAsDataURL(file);
    }
  };

  // === EXPORTAR A EXCEL ===
  const descargarExcel = () => {
    if (afiliadosFiltrados.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros en la lista actual para exportar.' });
      return;
    }

    const datosExcel = afiliadosFiltrados.map((afi) => ({
      "ID AFILIADO": afi.id_afiliado,
      "DPI / DOCUMENTO": afi.dpi,
      "NO. EMPADRONAMIENTO": afi.num_empadronamiento || "N/A",
      "NOMBRE COMPLETO": afi.nombre_completo?.toUpperCase(),
      "TELÉFONO": afi.telefono,
      "DIRECCIÓN DE RESIDENCIA": afi.direccion || "No registrada",
      "BARRIO / COLONIA": afi.barrio_colonia || "No registrado",
      "MUNICIPIO": afi.nombre_municipio || "N/A",
      "CENTRO DE VOTACIÓN": afi.lugar_votacion || "No asignado",
      "FECHA AFILIACIÓN": afi.fecha_afiliacion ? new Date(afi.fecha_afiliacion).toLocaleDateString() : "N/A",
      "REGISTRADO POR": afi.nombre_usuario || "Sistema"
    }));

    const hojaDeTrabajo = XLSX.utils.json_to_sheet(datosExcel);
    const libroDeTrabajo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libroDeTrabajo, hojaDeTrabajo, "Afiliados Registrados");

    const anchosColumnas = Object.keys(datosExcel[0]).map(key => ({
      wch: Math.max(...datosExcel.map(row => row[key] ? row[key].toString().length : 0), key.length) + 3
    }));
    hojaDeTrabajo['!cols'] = anchosColumnas;

    XLSX.writeFile(libroDeTrabajo, `Reporte_General_Afiliados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    Swal.fire({ icon: 'success', title: 'Excel Generado', text: 'El reporte se ha descargado de forma correcta.', timer: 2000, showConfirmButton: false });
  };

  // === EXPORTAR CERTIFICADO INDIVIDUAL (PDF) ===
  const descargarPDFIndividual = (val) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("PARTIDO CABAL, IZABAL", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Departamento de Registro de Afiliados", 14, 25);
    doc.text("Sistema Centralizado de Control de Lotes", 14, 30);
    doc.text(`Generado por: Auditoría de Sistemas`, 14, 35);

    doc.setFillColor(245, 247, 250); 
    doc.rect(130, 12, 66, 26, "F");  

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);  
    doc.text("EXPEDIENTE DE AFILIADO", 133, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text(`ID AFILIADO: #${val.id_afiliado}`, 133, 24); 
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha Ref: ${new Date().toLocaleDateString()}`, 133, 32);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42); 

    let startYTable = 75;
    if (val.foto) {
      try {
        doc.addImage(val.foto, 'JPEG', 14, 46, 25, 25);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(val.nombre_completo.toUpperCase(), 43, 52);
        doc.setFont("helvetica", "normal");
        doc.text(`DPI: ${val.dpi}`, 43, 58);
        doc.text(`Tel: ${val.telefono}`, 43, 64);
        startYTable = 78;
      } catch (e) {
        console.error("Error al renderizar la foto en el PDF", e);
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`DATOS GENERALES DE: ${val.nombre_completo.toUpperCase()}`, 14, 49);
      doc.setFont("helvetica", "normal");
      doc.text(`DPI asignado: ${val.dpi}`, 14, 56);
      startYTable = 64;
    }

    autoTable(doc, {
      startY: startYTable,
      head: [['PARÁMETRO REGISTRADO', 'VALOR EN SISTEMA']],
      body: [
        ['CÓDIGO ÚNICO', `AFI-${val.id_afiliado}`],
        ['DOCUMENTO DE IDENTIDAD (DPI)', val.dpi],
        ['NÚMERO DE EMPADRONAMIENTO', val.num_empadronamiento || 'No registrado'],
        ['LUGAR DE VOTACIÓN', val.lugar_votacion ? val.lugar_votacion.toUpperCase() : 'No asignado'],
        ['NOMBRE COMPLETO', val.nombre_completo.toUpperCase()],
        ['TELÉFONO DE CONTACTO', val.telefono],
        ['DIRECCIÓN DE RESIDENCIA', val.direccion || 'No registrada'],
        ['BARRIO / COLONIA', val.barrio_colonia || 'No registrado'],
        ['MUNICIPIO ASOCIADO', val.nombre_municipio || 'No especificado'],
        ['FECHA DE AFILIACIÓN', val.fecha_afiliacion ? new Date(val.fecha_afiliacion).toLocaleDateString() : 'No registrada'],
        ['REGISTRADO POR USUARIO', val.nombre_usuario || 'Sistema'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9.5, halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65, textColor: [50, 50, 50] },
        1: { cellWidth: 117 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Nota de seguridad: Esta ficha contiene datos privados e historial confidencial del afiliado.", 14, finalY);
    doc.text("Partido Cabal - Control Interno de Información.", 14, finalY + 4); 

    doc.save(`Ficha_Afiliado_${val.nombre_completo.replace(/\s+/g, '_')}.pdf`);
  };

  // === ACCIÓN: AGREGAR AFILIADO ===
  const add = () => {
    const fechaEnvio = fecha_afiliacion.trim() || new Date().toISOString().split('T')[0];

    if (!dpi.trim() || !num_empadronamiento.trim() || !nombre_completo.trim() || !telefono.trim() || !id_municipio || !id_usuario) {
      Swal.fire({
        icon: "warning",
        title: 'DATOS INCOMPLETOS',
        text: 'Por favor, complete los campos obligatorios incluyendo el Empadronamiento (*).',
        timer: 3000
      });
      return; 
    }

    Axios.post(`${API_URL}/crear`, { 
      dpi: dpi.trim(), 
      num_empadronamiento: num_empadronamiento.trim(),
      lugar_votacion: lugar_votacion.trim(),
      nombre_completo: nombre_completo.trim(), 
      telefono: telefono.trim(), 
      direccion: direccion.trim(), 
      barrio_colonia: barrio_colonia.trim(), 
      id_municipio: Number(id_municipio), 
      fecha_afiliacion: fechaEnvio, 
      id_usuario: Number(id_usuario), 
      foto: foto || null,
      operador_id: usuarioLogueado.id_usuario,
      operador_nombre: usuarioLogueado.nombre,
      operador_rol: usuarioLogueado.rol
    })
    .then(() => {
      getAfiliados();
      limpiarCampos();
      setShowRegModal(false);
      Swal.fire({ icon: "success", title: 'Afiliado registrado correctamente', showConfirmButton: false, timer: 2500 });
    })
    .catch((error) => {
      console.error(error);
      const mensajeError = error.response?.status === 413
        ? "La imagen seleccionada es demasiado grande para el servidor."
        : (error.response?.data?.message || 'Hubo un error en el sistema al guardar.');

      Swal.fire({ title: "No se registró", text: mensajeError, icon: 'error' });
    });
  };

  // === ACCIÓN: ACTUALIZAR AFILIADO ===
  const actualizar = () => {
    if (!dpi.trim() || !num_empadronamiento.trim() || !nombre_completo.trim() || !id_municipio || !id_usuario) {
      Swal.fire({ icon: 'warning', title: 'Campos obligatorios vacíos', text: 'El DPI y Empadronamiento son campos requeridos.' });
      return;
    }

    const fechaFormateada = fecha_afiliacion ? fecha_afiliacion.split('T')[0] : new Date().toISOString().split('T')[0];

    Axios.put(`${API_URL}/actualizar`, { 
      id_afiliado: Number(id_afiliado),
      dpi: dpi.trim(), 
      num_empadronamiento: num_empadronamiento.trim(),
      lugar_votacion: lugar_votacion.trim(),
      nombre_completo: nombre_completo.trim(), 
      telefono: telefono.trim(), 
      direccion: direccion.trim(), 
      barrio_colonia: barrio_colonia.trim(), 
      id_municipio: Number(id_municipio), 
      fecha_afiliacion: fechaFormateada, 
      id_usuario: Number(id_usuario), 
      foto: foto || null,
      operador_id: usuarioLogueado.id_usuario,
      operador_nombre: usuarioLogueado.nombre,
      operador_rol: usuarioLogueado.rol
    })
    .then(() => {
      getAfiliados();
      limpiarCampos();
      setShowEditModal(false);
      Swal.fire({ title: '¡Éxito!', text: 'Registro actualizado de manera directa', icon: 'success', timer: 2500, showConfirmButton: false });
    })
    .catch((error) => {
      console.error(error);
      const mensajeError = error.response?.status === 413
        ? "La imagen es demasiado grande para ser procesada."
        : (error.response?.data?.message || 'Error al actualizar las modificaciones.');

      Swal.fire({ icon: 'error', title: 'Error al actualizar', text: mensajeError });
    });
  };

  // === ACCIÓN: ELIMINAR AFILIADO ===
  const deleteAfiliado = (val) => {
    Swal.fire({
      title: "Confirmar eliminación",
      html: `¿Desea eliminar al afiliado <strong>${val.nombre_completo}</strong>?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminarlo!"
    }).then((result) => {
      if (result.isConfirmed) {
        Axios.delete(`${API_URL}/delete/${val.id_afiliado}`, {
          params: {
            operador_id: usuarioLogueado.id_usuario,
            operador_nombre: usuarioLogueado.nombre,
            operador_rol: usuarioLogueado.rol
          }
        })
        .then(() => {
          getAfiliados();
          Swal.fire('¡Eliminado!', 'El registro fue removido.', 'success');
        })
        .catch(err => {
          console.error(err);
          const errorMsg = err.response?.data?.message || 'No se pudo eliminar el registro.';
          Swal.fire('Error', errorMsg, 'error');
        });
      }
    });
  };

  const limpiarCampos = () => {
    setId_afiliado(""); setDpi(""); setNombre_completo(""); setTelefono("");
    setDireccion(""); setBarrio_colonia(""); setId_municipio("");
    setFecha_afiliacion(""); setId_usuario(""); setFoto("");
    setNum_empadronamiento(""); setLugar_votacion("");
  };

  const getAfiliados = useCallback(() => {
    Axios.get(API_URL, { params: { pagina, limite: 10 } })
      .then((res) => {
        const payload = res.data;
        const data = Array.isArray(payload) ? payload : (payload.data || []);
        setAfiliados(data);
        setPaginasTotales(Array.isArray(payload) ? 1 : (payload.paginasTotales || 1));
        setTotalRegistros(Array.isArray(payload) ? data.length : (payload.total || data.length));
      })
      .catch(err => console.error(err));
  }, [API_URL, pagina]);

  const getCatalogos = useCallback(() => {
    Axios.get(`${BASE_URL}/municipios`).then((res) => setMunicipios(res.data)).catch(err => console.error(err));
    Axios.get(`${BASE_URL}/usuarios`).then((res) => setUsuarios(res.data)).catch(err => console.error(err));
  }, [BASE_URL]);

  useEffect(() => { 
    getAfiliados(); 
    getCatalogos(); 
  }, [getAfiliados, getCatalogos]);

  const abrirEditarModal = (val) => {
    setId_afiliado(val.id_afiliado);
    setDpi(val.dpi);
    setNombre_completo(val.nombre_completo);
    setTelefono(val.telefono);
    setDireccion(val.direccion || "");
    setBarrio_colonia(val.barrio_colonia || "");
    setId_municipio(val.id_municipio);
    setFecha_afiliacion(val.fecha_afiliacion ? val.fecha_afiliacion.split('T')[0] : "");
    setId_usuario(val.id_usuario);
    setFoto(val.foto || "");
    setNum_empadronamiento(val.num_empadronamiento || "");
    setLugar_votacion(val.lugar_votacion || "");
    setShowEditModal(true);
  };

  const afiliadosFiltrados = afiliadosList.filter((afi) => 
    afi.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    afi.dpi?.includes(busqueda) ||
    afi.num_empadronamiento?.includes(busqueda)
  );

  return (
    <div className='container-fluid mt-3 px-2 px-md-3'>
      {/* CABECERA */}
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm">
        <div className="col-md-3">
          <h4 className="m-0 text-dark fw-bold">GESTIÓN DE AFILIADOS</h4>
        </div>
        <div className="col-md-4">
          <div className="input-group">
            <span className="input-group-text bg-primary text-white">🔍</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por nombre, DPI o padrón..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-5 text-end d-flex gap-2">
          <button className="btn btn-outline-success fw-bold flex-fill" onClick={descargarExcel}>
            📥 DESCARGAR EXCEL
          </button>
          <button className="btn btn-success fw-bold flex-fill" onClick={() => { limpiarCampos(); setShowRegModal(true); }}>
            ➕ AGREGAR AFILIADO
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
      
      {/* TABLA PRINCIPAL */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>FOTO</th>
              <th>DPI</th>
              <th>EMPADRONAMIENTO</th>
              <th>NOMBRE COMPLETO</th>
              <th>TELÉFONO</th>
              <th>CENTRO DE VOTACIÓN</th>
              <th>MUNICIPIO</th>
              <th className="text-center">OPERACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {afiliadosFiltrados.length > 0 ? (
              afiliadosFiltrados.map((val) => (
                <tr key={val.id_afiliado}>
                  <td className="text-center">
                    {val.foto ? (
                      <img src={val.foto} alt="Perfil" className="rounded-circle" style={{ width: '45px', height: '45px', objectFit: 'cover' }} />
                    ) : (
                      <div className="bg-secondary text-white rounded-circle d-inline-block text-center pt-2" style={{ width: '45px', height: '45px', fontSize: '12px' }}>S/F</div>
                    )}
                  </td>
                  <td><strong>{val.dpi}</strong></td>
                  <td className="text-primary fw-bold">{val.num_empadronamiento || "N/A"}</td>
                  <td>{val.nombre_completo}</td>
                  <td>{val.telefono}</td>
                  <td><small>{val.lugar_votacion || "No asignado"}</small></td>
                  <td><span className="badge bg-info text-dark">{val.nombre_municipio || "N/A"}</span></td>
                  <td>
                    <div className="d-flex justify-content-center">
                      <button type="button" onClick={() => abrirEditarModal(val)} className="btn btn-info btn-sm mx-1 fw-bold text-white">ACTUALIZAR</button>
                      <button type="button" onClick={() => deleteAfiliado(val)} className="btn btn-danger btn-sm mx-1 fw-bold">ELIMINAR</button>
                      <button type="button" onClick={() => descargarPDFIndividual(val)} className="btn btn-secondary btn-sm mx-1 fw-bold">📄 PDF</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted py-3">No se encontraron afiliados coincidentes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL REGISTRO */}
      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Registrar Nuevo Afiliado</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowRegModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Documento (DPI): *</label>
                    <input type="text" value={dpi} onChange={(e) => setDpi(e.target.value)} className="form-control" placeholder="Ingrese DPI" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Número de Empadronamiento: *</label>
                    <input type="text" value={num_empadronamiento} onChange={(e) => setNum_empadronamiento(e.target.value)} className="form-control" placeholder="Ingrese número de padrón" />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Nombre Completo: *</label>
                    <input type="text" value={nombre_completo} onChange={(e) => setNombre_completo(e.target.value)} className="form-control" placeholder="Nombre completo" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Teléfono: *</label>
                    <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="form-control" placeholder="Número telefónico" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Lugar / Centro de Votación:</label>
                  <input type="text" value={lugar_votacion} onChange={(e) => setLugar_votacion(e.target.value)} className="form-control" placeholder="Ej: Escuela Oficial" />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio / Colonia:</label>
                    <input type="text" value={barrio_colonia} onChange={(e) => setBarrio_colonia(e.target.value)} className="form-control" placeholder="Ej: Barrio El Centro" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Dirección de Residencia:</label>
                    <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="form-control" placeholder="Dirección completa" />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio de Residencia: *</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select">
                      <option value="">-- Seleccione Municipio --</option>
                      {municipiosList.map((m) => <option key={m.id_municipio} value={m.id_municipio}>{m.nombre_municipio}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Usuario Coordinador (Asignado): *</label>
                    <select value={id_usuario} onChange={(e) => setId_usuario(e.target.value)} className="form-select">
                      <option value="">-- Seleccione Usuario --</option>
                      {usuariosList.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row align-items-center">
                  <div className="col-md-8 mb-3">
                    <label className="form-label fw-bold">Fotografía del Afiliado (Opcional):</label>
                    <input type="file" accept="image/*" onChange={handleFotoChange} className="form-control" />
                  </div>
                  <div className="col-md-4 mb-3 text-center">
                    {foto && <img src={foto} alt="Preview" className="img-thumbnail" style={{ maxHeight: '90px' }} />}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRegModal(false); limpiarCampos(); }}>Cancelar</button>
                <button type="button" className="btn btn-success fw-bold" onClick={add}>Guardar Afiliado</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Actualizar Afiliado #{id_afiliado}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Documento (DPI): *</label>
                    <input type="text" value={dpi} onChange={(e) => setDpi(e.target.value)} className="form-control" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Número de Empadronamiento: *</label>
                    <input type="text" value={num_empadronamiento} onChange={(e) => setNum_empadronamiento(e.target.value)} className="form-control" />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Nombre Completo: *</label>
                    <input type="text" value={nombre_completo} onChange={(e) => setNombre_completo(e.target.value)} className="form-control" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Teléfono: *</label>
                    <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="form-control" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Lugar / Centro de Votación:</label>
                  <input type="text" value={lugar_votacion} onChange={(e) => setLugar_votacion(e.target.value)} className="form-control" />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Barrio / Colonia:</label>
                    <input type="text" value={barrio_colonia} onChange={(e) => setBarrio_colonia(e.target.value)} className="form-control" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Dirección de Residencia:</label>
                    <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="form-control" />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Municipio de Residencia: *</label>
                    <select value={id_municipio} onChange={(e) => setId_municipio(e.target.value)} className="form-select">
                      <option value="">-- Seleccione Municipio --</option>
                      {municipiosList.map((m) => <option key={m.id_municipio} value={m.id_municipio}>{m.nombre_municipio}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Usuario Coordinador (Asignado): *</label>
                    <select value={id_usuario} onChange={(e) => setId_usuario(e.target.value)} className="form-select">
                      <option value="">-- Seleccione Usuario --</option>
                      {usuariosList.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row align-items-center">
                  <div className="col-md-8 mb-3">
                    <label className="form-label fw-bold">Fotografía del Afiliado (Opcional):</label>
                    <input type="file" accept="image/*" onChange={handleFotoChange} className="form-control" />
                  </div>
                  <div className="col-md-4 mb-3 text-center">
                    {foto && <img src={foto} alt="Preview" className="img-thumbnail" style={{ maxHeight: '90px' }} />}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); limpiarCampos(); }}>Cancelar</button>
                <button type="button" className="btn btn-warning fw-bold" onClick={actualizar}>Actualizar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Afiliados;