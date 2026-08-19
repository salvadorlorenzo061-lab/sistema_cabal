import { useCallback, useEffect, useState } from 'react';
import Axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';
import PaginationBar from './PaginationBar';
import { normalizarLocalidadesJalapa } from '../data/localidadesJalapa';

function PersonaCrudBase({
  apiPath,
  idField,
  entityLabel,
  entityLabelPlural,
  heading,
  createLabel,
  accentClass = 'primary',
  useLocalidadesEnDireccion = false
}) {
  const sesionActiva = (() => {
    try {
      return JSON.parse(localStorage.getItem('sesion_cabal') || 'null');
    } catch (_) {
      return null;
    }
  })();

  const usuarioLogueado = {
    id_usuario: Number(sesionActiva?.id_usuario) || 0,
    nombre: sesionActiva?.nombre || 'SISTEMA',
    rol: sesionActiva?.rol || 'Operador'
  };

  const API_URL = `https://sistema-cabal.onrender.com/api/${apiPath}`;

  const [idRegistro, setIdRegistro] = useState('');
  const [dpi, setDpi] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [foto, setFoto] = useState('');

  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [paginasTotales, setPaginasTotales] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const localidadesOptions = normalizarLocalidadesJalapa();

  const localidadLabel = (item) =>
    `${item.nombre}${item.tipo ? ` (${item.tipo})` : ''}${item.parent ? ` - ${item.parent}` : ''}`;

  const limpiarCampos = () => {
    setIdRegistro('');
    setDpi('');
    setNombre('');
    setDireccion('');
    setTelefono('');
    setObservaciones('');
    setEstado('Activo');
    setFoto('');
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'Archivo muy pesado', text: 'La imagen no debe superar 2MB.' });
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setFoto(reader.result);
    reader.readAsDataURL(file);
  };

  const getRegistros = useCallback(() => {
    Axios.get(API_URL, { params: { pagina, limite: 10, id_usuario: usuarioLogueado.id_usuario, rol: usuarioLogueado.rol } })
      .then((res) => {
        const payload = res.data;
        const data = Array.isArray(payload) ? payload : (payload.data || []);
        setRegistros(data);
        setPaginasTotales(Array.isArray(payload) ? 1 : (payload.paginasTotales || 1));
        setTotalRegistros(Array.isArray(payload) ? data.length : (payload.total || data.length));
      })
      .catch((err) => console.error(err));
  }, [API_URL, pagina, usuarioLogueado.id_usuario, usuarioLogueado.rol]);

  useEffect(() => {
    getRegistros();
  }, [getRegistros]);

  const buildPayload = () => ({
    dpi: dpi.trim(),
    nombre: nombre.trim(),
    direccion: direccion.trim(),
    telefono: telefono.trim(),
    observaciones: observaciones.trim(),
    estado,
    foto: foto || null,
    operador_id: usuarioLogueado.id_usuario,
    operador_nombre: usuarioLogueado.nombre,
    operador_rol: usuarioLogueado.rol
  });

  const add = () => {
    Axios.post(`${API_URL}/crear`, buildPayload())
      .then(() => {
        getRegistros();
        limpiarCampos();
        setShowRegModal(false);
        Swal.fire({ icon: 'success', title: `${entityLabel} registrado`, timer: 2200, showConfirmButton: false });
      })
      .catch((error) => {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: error.response?.data?.message || 'Hubo un error al registrar.'
        });
      });
  };

  const actualizar = () => {
    Axios.put(`${API_URL}/actualizar`, {
      [idField]: Number(idRegistro),
      ...buildPayload()
    })
      .then(() => {
        getRegistros();
        limpiarCampos();
        setShowEditModal(false);
        Swal.fire({ icon: 'success', title: `${entityLabel} actualizado`, timer: 2200, showConfirmButton: false });
      })
      .catch((error) => {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo actualizar',
          text: error.response?.data?.message || 'Hubo un error al actualizar.'
        });
      });
  };

  const eliminar = (val) => {
    Swal.fire({
      title: 'Confirmar eliminación',
      html: `¿Desea eliminar a <strong>${val.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      Axios.delete(`${API_URL}/delete/${val[idField]}`, {
        params: {
          operador_id: usuarioLogueado.id_usuario,
          operador_nombre: usuarioLogueado.nombre,
          operador_rol: usuarioLogueado.rol
        }
      })
        .then(() => {
          getRegistros();
          Swal.fire({ icon: 'success', title: `${entityLabel} eliminado`, timer: 2200, showConfirmButton: false });
        })
        .catch((error) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: error.response?.data?.message || 'Hubo un error al eliminar.'
          });
        });
    });
  };

  const abrirEditarModal = (val) => {
    setIdRegistro(val[idField]);
    setDpi(val.dpi || '');
    setNombre(val.nombre || '');
    setDireccion(val.direccion || '');
    setTelefono(val.telefono || '');
    setObservaciones(val.observaciones || '');
    setEstado(val.estado || 'Activo');
    setFoto(val.foto || '');
    setShowEditModal(true);
  };

  const registrosFiltrados = registros.filter((item) =>
    item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.dpi?.includes(busqueda) ||
    item.telefono?.includes(busqueda)
  );

  const modalClass = accentClass === 'danger' ? 'bg-danger text-white' : accentClass === 'success' ? 'bg-success text-white' : 'bg-primary text-white';
  const buttonClass = accentClass === 'danger' ? 'btn-danger' : accentClass === 'success' ? 'btn-success' : 'btn-primary';

  return (
    <div className="container-fluid mt-3 px-2 px-md-3">
      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm module-toolbar">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">{heading}</h3>
          <small className="text-muted">Operador activo: <strong>{usuarioLogueado.nombre}</strong></small>
        </div>
        <div className="col-md-5">
          <div className="input-group">
            <span className={`input-group-text bg-${accentClass} text-white`}>🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, DPI o celular..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button className={`btn ${buttonClass} fw-bold w-100`} onClick={() => { limpiarCampos(); setShowRegModal(true); }}>
            ➕ {createLabel}
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

      <div className="table-responsive module-table-wrap">
        <table className="table table-striped table-bordered align-middle shadow-sm module-table-centered">
          <thead className="table-dark">
            <tr>
              <th>FOTO</th>
              <th>DPI</th>
              <th>NOMBRE</th>
              <th>CELULAR</th>
              <th>DIRECCION</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACION</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.length > 0 ? (
              registrosFiltrados.map((val) => (
                <tr key={val[idField]}>
                  <td className="text-center">
                    {val.foto ? (
                      <img src={val.foto} alt={val.nombre} className="rounded-circle" style={{ width: '45px', height: '45px', objectFit: 'cover' }} />
                    ) : (
                      <div className="bg-secondary text-white rounded-circle d-inline-block text-center pt-2" style={{ width: '45px', height: '45px', fontSize: '12px' }}>S/F</div>
                    )}
                  </td>
                  <td><strong>{val.dpi}</strong></td>
                  <td>
                    <div className="fw-bold">{val.nombre}</div>
                    <small className="text-muted">{val.observaciones || 'Sin observaciones'}</small>
                  </td>
                  <td>{val.telefono || 'N/A'}</td>
                  <td>{val.direccion || 'N/A'}</td>
                  <td>
                    <span className={`badge bg-${String(val.estado).toLowerCase() === 'activo' ? 'success' : 'secondary'}`}>
                      {(val.estado || 'Desactivado').toUpperCase()}
                    </span>
                  </td>
                  <td className="text-center">
                    <select
                      className="form-select form-select-sm fw-bold bg-light border-secondary module-action-select"
                      defaultValue=""
                      onChange={(e) => {
                        const accion = e.target.value;
                        if (!accion) return;
                        if (accion === 'actualizar') abrirEditarModal(val);
                        if (accion === 'eliminar') eliminar(val);
                        e.target.value = '';
                      }}
                    >
                      <option value="" disabled>Acciones</option>
                      <option value="actualizar">Actualizar</option>
                      <option value="eliminar">Eliminar</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">No se encontraron {entityLabelPlural}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className={`modal-header ${modalClass}`}>
                <h5 className="modal-title fw-bold">Registrar {entityLabel}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowRegModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">DPI</label>
                    <input type="text" className="form-control" value={dpi} onChange={(e) => setDpi(e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Nombre</label>
                    <input type="text" className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Numero celular</label>
                    <input type="text" className="form-control" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Estado</label>
                    <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                      <option value="Activo">Activo</option>
                      <option value="Desactivado">Desactivado</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Direccion</label>
                  <input
                    type="text"
                    className="form-control"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    list={useLocalidadesEnDireccion ? `localidades-direccion-crear-${apiPath}` : undefined}
                    placeholder={useLocalidadesEnDireccion ? 'Escriba para buscar aldea, caserio, barrio o colonia' : undefined}
                  />
                  {useLocalidadesEnDireccion && (
                    <>
                      <datalist id={`localidades-direccion-crear-${apiPath}`}>
                        {localidadesOptions.map((item) => (
                          <option key={`crear-${apiPath}-${item.nombre}-${item.parent || 'sin-parent'}`} value={item.nombre} label={localidadLabel(item)} />
                        ))}
                      </datalist>
                      <small className="text-muted">Empiece a escribir una ubicacion de Jalapa y seleccione la coincidencia.</small>
                    </>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Observaciones</label>
                  <textarea className="form-control" rows="3" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}></textarea>
                </div>
                <div className="row align-items-center">
                  <div className="col-md-8 mb-3">
                    <label className="form-label fw-bold">Fotografia (Opcional)</label>
                    <input type="file" accept="image/*" className="form-control" onChange={handleFotoChange} />
                  </div>
                  <div className="col-md-4 mb-3 text-center">
                    {foto && <img src={foto} alt="Preview" className="img-thumbnail" style={{ maxHeight: '90px' }} />}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowRegModal(false); limpiarCampos(); }}>Cancelar</button>
                <button className={`btn ${buttonClass} fw-bold`} onClick={add}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Actualizar {entityLabel} #{idRegistro}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); limpiarCampos(); }}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">DPI</label>
                    <input type="text" className="form-control" value={dpi} onChange={(e) => setDpi(e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Nombre</label>
                    <input type="text" className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Numero celular</label>
                    <input type="text" className="form-control" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Estado</label>
                    <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                      <option value="Activo">Activo</option>
                      <option value="Desactivado">Desactivado</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Direccion</label>
                  <input
                    type="text"
                    className="form-control"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    list={useLocalidadesEnDireccion ? `localidades-direccion-editar-${apiPath}` : undefined}
                    placeholder={useLocalidadesEnDireccion ? 'Escriba para buscar aldea, caserio, barrio o colonia' : undefined}
                  />
                  {useLocalidadesEnDireccion && (
                    <>
                      <datalist id={`localidades-direccion-editar-${apiPath}`}>
                        {localidadesOptions.map((item) => (
                          <option key={`editar-${apiPath}-${item.nombre}-${item.parent || 'sin-parent'}`} value={item.nombre} label={localidadLabel(item)} />
                        ))}
                      </datalist>
                      <small className="text-muted">Empiece a escribir una ubicacion de Jalapa y seleccione la coincidencia.</small>
                    </>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Observaciones</label>
                  <textarea className="form-control" rows="3" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}></textarea>
                </div>
                <div className="row align-items-center">
                  <div className="col-md-8 mb-3">
                    <label className="form-label fw-bold">Fotografia (Opcional)</label>
                    <input type="file" accept="image/*" className="form-control" onChange={handleFotoChange} />
                  </div>
                  <div className="col-md-4 mb-3 text-center">
                    {foto && <img src={foto} alt="Preview" className="img-thumbnail" style={{ maxHeight: '90px' }} />}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); limpiarCampos(); }}>Cancelar</button>
                <button className="btn btn-warning fw-bold" onClick={actualizar}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaCrudBase;
