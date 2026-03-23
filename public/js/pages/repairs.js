let repairsData = [];
let customersForRepair = [];
let deviceTypesList = [];
let brandsList = [];
let modelsList = [];
let currentStatusFilter = 'all';
const STATUSES = [
  { key: 'received', label: 'Recibido' },
  { key: 'diagnosing', label: 'Diagnostico' },
  { key: 'waiting_parts', label: 'Esperando repuestos' },
  { key: 'repairing', label: 'En reparacion' },
  { key: 'ready', label: 'Listo' },
  { key: 'delivered', label: 'Entregado' }
];

async function renderRepairs() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    const repairsResult = await api.repairs.getAll({});
    const customersResult = await api.customers.getAll({});
    const typesResult = await api.deviceOptions.getDeviceTypes();
    const brandsResult = await api.deviceOptions.getBrands();
    const modelsResult = await api.deviceOptions.getModels();

    repairsData = repairsResult;
    customersForRepair = customersResult;
    deviceTypesList = typesResult;
    brandsList = brandsResult;
    modelsList = modelsResult;

    const customerOptions = customersForRepair.map(c => '<option value="' + c.id + '">' + app.escapeHtml(c.name) + '</option>').join('');
    const typeOptions = deviceTypesList.map(t => '<option value="' + app.escapeAttr(t.name) + '">' + app.escapeHtml(t.name) + '</option>').join('');
    const brandOptions = brandsList.map(b => '<option value="' + app.escapeAttr(b.name) + '">' + app.escapeHtml(b.name) + '</option>').join('');

    content.innerHTML =
      '<div class="card">' +
      '<div class="card-header">' +
      '<h3 class="card-title">Gestion de Reparaciones</h3>' +
      '<button class="btn btn-primary" onclick="showRepairModal()">+ Nueva Reparacion</button>' +
      '</div>' +
      '<div class="repair-status-flow">' +
      '<span class="status-step active" onclick="filterByStatus(\'all\')">Todas</span>' +
      STATUSES.map(s => '<span class="status-step" onclick="filterByStatus(\'' + s.key + '\')">' + app.escapeHtml(s.label) + '</span>').join('') +
      '</div>' +
      '<div class="toolbar">' +
      '<div class="search-box"><input type="text" id="repair-search" placeholder="Buscar por ticket o cliente..." oninput="filterRepairs()" style="padding:10px;border:1px solid #ddd;border-radius:6px;width:100%;max-width:300px;font-size:14px;"></div>' +
      '<button class="btn btn-warning" onclick="renderRepairs()">Actualizar</button>' +
      '</div>' +
      '<div class="table-container"><table><thead><tr><th>Ticket</th><th>Cliente</th><th>Dispositivo</th><th>Marca</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="repairs-table"></tbody></table></div>' +
      '</div>' +
      getRepairModalHtml(customerOptions, typeOptions, brandOptions);

    filterRepairs();
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + app.escapeHtml(e.message) + '</div>';
  }
}

function renderRepairsTable(repairs) {
  const tbody = document.getElementById('repairs-table');
  if (!tbody) return;

  tbody.innerHTML = repairs.map(r => {
    const statusInfo = STATUSES.find(s => s.key === r.status) || { label: r.status };
    return '<tr><td><strong>' + app.escapeHtml(r.ticket_number) + '</strong></td><td>' + app.escapeHtml(r.customer_name) + '</td><td>' + app.escapeHtml(r.device_type) + '</td><td>' + app.escapeHtml(r.brand || '') + '</td><td><span class="badge badge-' + (r.status === 'ready' ? 'green' : r.status === 'delivered' ? 'green' : 'blue') + '">' + app.escapeHtml(statusInfo.label) + '</span></td><td><button class="btn btn-sm btn-secondary" onclick="viewRepair(' + r.id + ')">Ver</button></td></tr>';
  }).join('');
}

function filterByStatus(status) {
  currentStatusFilter = status;
  document.querySelectorAll('.status-step').forEach((el, idx) => {
    el.classList.toggle('active', (status === 'all' && idx === 0) || STATUSES[idx - 1]?.key === status);
  });
  filterRepairs();
}

function filterRepairs() {
  const search = (document.getElementById('repair-search') || {}).value || '';
  const normalized = search.toLowerCase();
  const filtered = repairsData.filter(r => {
    const matchesSearch = r.ticket_number.toLowerCase().includes(normalized) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(normalized));
    const matchesStatus = currentStatusFilter === 'all' || r.status === currentStatusFilter;
    return matchesSearch && matchesStatus;
  });
  renderRepairsTable(filtered);
}

function getRepairModalHtml(customers, typeOptions, brandOptions) {
  return '<div id="repair-modal" style="display:none;"><div class="modal"><div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;"><h3>Nueva Reparacion</h3><button class="modal-close" onclick="closeRepairModal()" style="background:#ef4444;color:white;border:none;border-radius:50%;width:30px;height:30px;font-size:18px;cursor:pointer;line-height:1;">&times;</button></div><div class="modal-body"><form><input type="hidden" id="repair-id">' +
    '<div class="form-group"><label>Cliente</label><select id="repair-customer">' + customers + '</select></div>' +
    '<div class="form-group"><label>Tipo de Dispositivo</label><select id="repair-device-type">' + typeOptions + '</select></div>' +
    '<div class="form-row"><div class="form-group"><label>Marca</label><select id="repair-brand" onchange="filterModelsByBrand()">' + brandOptions + '</select></div><div class="form-group"><label>Modelo</label><select id="repair-model"><option value="">Seleccionar modelo...</option></select></div></div>' +
    '<div class="form-row"><div class="form-group"><label>Numero de Serie</label><input type="text" id="repair-serial"></div><div class="form-group"><label>IMEI</label><input type="text" id="repair-imei"></div></div>' +
    '<div class="form-row"><div class="form-group"><label>Contrasena</label><input type="text" id="repair-password"></div><div class="form-group"><label>Patron</label><input type="text" id="repair-pattern"></div></div>' +
    '<div class="form-group"><label>Problema</label><textarea id="repair-problem" rows="3"></textarea></div>' +
    '<div class="form-group"><label>Accesorios</label><input type="text" id="repair-accessories"></div></form></div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeRepairModal()">Cancelar</button><button class="btn btn-primary" onclick="saveRepair()">Guardar</button></div></div></div>';
}

function filterModelsByBrand() {
  const brandSelect = document.getElementById('repair-brand');
  const modelSelect = document.getElementById('repair-model');
  if (!brandSelect || !modelSelect) return;

  const selectedBrand = brandSelect.value;
  const brandObj = brandsList.find(b => b.name === selectedBrand);
  const brandId = brandObj ? brandObj.id : null;
  const filteredModels = modelsList.filter(m => !brandId || m.brand_id === brandId);

  modelSelect.innerHTML = '<option value="">Seleccionar modelo...</option>' +
    filteredModels.map(m => '<option value="' + app.escapeAttr(m.name) + '">' + app.escapeHtml(m.name) + '</option>').join('');
}

function getRepairDetailHtml(repair) {
  const statusOptions = STATUSES.map(s => '<option value="' + s.key + '"' + (s.key === repair.status ? ' selected' : '') + '>' + app.escapeHtml(s.label) + '</option>').join('');
  const logsHtml = repair.logs && repair.logs.length > 0
    ? repair.logs.map(l => '<div class="repair-log"><span class="log-date">' + app.escapeHtml(l.created_at) + '</span><span class="log-status">' + app.escapeHtml(STATUSES.find(s => s.key === l.status)?.label || l.status) + '</span><span class="log-notes">' + app.escapeHtml(l.notes || '') + '</span></div>').join('')
    : '<p>No hay historial</p>';

  return '<div id="repair-detail-modal"><div class="modal" style="max-width:600px;"><div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;"><h3>Detalle de Reparacion</h3><button class="modal-close" onclick="closeRepairDetailModal()" style="background:#ef4444;color:white;border:none;border-radius:50%;width:30px;height:30px;font-size:18px;cursor:pointer;line-height:1;">&times;</button></div><div class="modal-body">' +
    '<div class="detail-section">' +
    '<div class="detail-row"><span class="detail-label">Ticket:</span><span class="detail-value"><strong>' + app.escapeHtml(repair.ticket_number) + '</strong></span></div>' +
    '<div class="detail-row"><span class="detail-label">Cliente:</span><span class="detail-value">' + app.escapeHtml(repair.customer_name) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Telefono:</span><span class="detail-value">' + app.escapeHtml(repair.customer_phone || '-') + '</span></div>' +
    '</div>' +
    '<h4>Informacion del Dispositivo</h4>' +
    '<div class="form-row"><div class="form-group"><label>Tipo</label><input type="text" id="detail-device-type" value="' + app.escapeAttr(repair.device_type || '') + '"></div><div class="form-group"><label>Marca</label><input type="text" id="detail-brand" value="' + app.escapeAttr(repair.brand || '') + '"></div></div>' +
    '<div class="form-row"><div class="form-group"><label>Modelo</label><input type="text" id="detail-model" value="' + app.escapeAttr(repair.model || '') + '"></div><div class="form-group"><label>Numero de Serie</label><input type="text" id="detail-serial" value="' + app.escapeAttr(repair.serial_number || '') + '"></div></div>' +
    '<div class="form-row"><div class="form-group"><label>IMEI</label><input type="text" id="detail-imei" value="' + app.escapeAttr(repair.imei || '') + '"></div><div class="form-group"><label>Contrasena</label><input type="text" id="detail-password" value="' + app.escapeAttr(repair.password || '') + '"></div></div>' +
    '<div class="form-group"><label>Patron</label><input type="text" id="detail-pattern" value="' + app.escapeAttr(repair.pattern || '') + '"></div>' +
    '<div class="form-group"><label>Problema Reportado</label><textarea id="detail-problem" rows="2">' + app.escapeHtml(repair.problem_description || '') + '</textarea></div>' +
    '<div class="form-group"><label>Accesorios</label><input type="text" id="detail-accessories" value="' + app.escapeAttr(repair.accessories || '') + '"></div>' +
    '<h4>Estado y Precios</h4>' +
    '<div class="form-row"><div class="form-group"><label>Estado</label><select id="detail-status" onchange="showStatusNotes()">' + statusOptions + '</select></div></div>' +
    '<div class="form-row"><div class="form-group"><label>Precio Estimado</label><input type="number" id="detail-estimated" value="' + app.escapeAttr(repair.estimated_price || '') + '"></div><div class="form-group"><label>Precio Final</label><input type="number" id="detail-final" value="' + app.escapeAttr(repair.final_price || '') + '"></div></div>' +
    '<div class="form-group"><label>Notas del Tecnico</label><textarea id="detail-notes" rows="2">' + app.escapeHtml(repair.technician_notes || '') + '</textarea></div>' +
    '<div id="status-notes-section" style="display:none;"><div class="form-group"><label>Notas del Cambio de Estado</label><input type="text" id="detail-status-notes" placeholder="Agregar nota..."></div></div>' +
    '<h4>Historial</h4>' +
    '<div class="repair-logs">' + logsHtml + '</div>' +
    '</div>' +
    '<div class="modal-footer">' +
    '<button class="btn btn-secondary" onclick="closeRepairDetailModal()">Cerrar</button>' +
    '<button class="btn btn-info" onclick="printRepairTicket(' + repair.id + ')">Imprimir</button>' +
    '<button class="btn btn-warning" onclick="deleteRepair(' + repair.id + ')">Eliminar</button>' +
    '<button class="btn btn-primary" onclick="updateRepair(' + repair.id + ')">Guardar</button>' +
    '</div></div></div>';
}

function showStatusNotes() {
  const status = document.getElementById('detail-status').value;
  const notesSection = document.getElementById('status-notes-section');
  notesSection.style.display = status !== 'delivered' ? 'block' : 'none';
}

function closeRepairDetailModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function showRepairModal() {
  document.getElementById('repair-modal').style.display = 'block';
  filterModelsByBrand();
}

function closeRepairModal() {
  document.getElementById('repair-modal').style.display = 'none';
}

async function viewRepair(id) {
  try {
    const r = await api.repairs.getOne(id);
    const modalContent = getRepairDetailHtml(r);
    document.getElementById('modal-container').innerHTML = '<div class="modal-overlay" onclick="if(event.target === this) closeRepairDetailModal()">' + modalContent + '</div>';
  } catch (e) {
    alert(e.message);
  }
}

async function saveRepair() {
  const data = {
    customer_id: parseInt(document.getElementById('repair-customer').value, 10),
    device_type: document.getElementById('repair-device-type').value,
    brand: document.getElementById('repair-brand').value,
    model: document.getElementById('repair-model').value,
    serial_number: document.getElementById('repair-serial').value,
    imei: document.getElementById('repair-imei').value,
    password: document.getElementById('repair-password').value,
    pattern: document.getElementById('repair-pattern').value,
    problem_description: document.getElementById('repair-problem').value,
    accessories: document.getElementById('repair-accessories').value
  };
  try {
    await api.repairs.create(data);
    closeRepairModal();
    renderRepairs();
  } catch (e) {
    alert(e.message);
  }
}

async function updateRepair(id) {
  const data = {
    device_type: document.getElementById('detail-device-type').value,
    brand: document.getElementById('detail-brand').value,
    model: document.getElementById('detail-model').value,
    serial_number: document.getElementById('detail-serial').value,
    imei: document.getElementById('detail-imei').value,
    password: document.getElementById('detail-password').value,
    pattern: document.getElementById('detail-pattern').value,
    problem_description: document.getElementById('detail-problem').value,
    accessories: document.getElementById('detail-accessories').value,
    estimated_price: document.getElementById('detail-estimated').value ? parseFloat(document.getElementById('detail-estimated').value) : null,
    final_price: document.getElementById('detail-final').value ? parseFloat(document.getElementById('detail-final').value) : null,
    technician_notes: document.getElementById('detail-notes').value
  };
  const newStatus = document.getElementById('detail-status').value;
  const statusNotes = document.getElementById('detail-status-notes').value;

  try {
    await api.repairs.update(id, data);
    const currentRepair = await api.repairs.getOne(id);
    if (currentRepair.status !== newStatus) {
      await api.repairs.updateStatus(id, newStatus, statusNotes);
    }
    closeRepairDetailModal();
    renderRepairs();
  } catch (e) {
    alert(e.message);
  }
}

async function printRepairTicket(id) {
  try {
    const repair = await api.repairs.getOne(id);
    const businessName = window.businessName || 'Milo Pro';

    let ticketText = '       ' + businessName + '\n';
    ticketText += '       ORDEN DE SERVICIO\n';
    ticketText += '============================\n';
    ticketText += 'Ticket: ' + repair.ticket_number + '\n';
    ticketText += 'Fecha: ' + new Date(repair.created_at).toLocaleString('es-AR') + '\n';
    ticketText += '----------------------------\n';
    ticketText += 'CLIENTE:\n' + repair.customer_name + '\n';
    ticketText += 'Tel: ' + (repair.customer_phone || 'Sin telefono') + '\n';
    ticketText += '============================\n';
    ticketText += 'DISPOSITIVO:\n';
    ticketText += 'Tipo: ' + repair.device_type + '\n';
    ticketText += 'Marca: ' + (repair.brand || '-') + '\n';
    ticketText += 'Modelo: ' + (repair.model || '-') + '\n';
    ticketText += 'N/S: ' + (repair.serial_number || '-') + '\n';
    ticketText += 'IMEI: ' + (repair.imei || '-') + '\n';
    ticketText += '============================\n';
    ticketText += 'Clave: ' + (repair.password || '-') + '\n';
    ticketText += 'Patron: ' + (repair.pattern || '-') + '\n';
    ticketText += '============================\n';
    ticketText += 'PROBLEMA:\n' + repair.problem_description + '\n';
    ticketText += '----------------------------\n';
    ticketText += 'Accesorios: ' + (repair.accessories || 'Ninguno') + '\n';
    ticketText += '============================\n';
    ticketText += 'ESTADO: ' + (STATUSES.find(s => s.key === repair.status)?.label || repair.status) + '\n';
    if (repair.estimated_price) ticketText += 'Presupuesto: ' + app.formatMoney(repair.estimated_price) + '\n';
    if (repair.final_price) ticketText += 'Total: ' + app.formatMoney(repair.final_price) + '\n';
    ticketText += '============================\n';
    ticketText += '\n\n\n\n\n';

    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    printFrame.name = 'printRepairFrame';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write('<!DOCTYPE html><html><head><title>Orden de Reparacion</title>');
    frameDoc.write('<style>@page { margin: 0; } body { margin: 0; padding: 5px; font-family: monospace; font-size: 10px; }</style>');
    frameDoc.write('</head><body><pre style="margin:0;">' + app.escapeHtml(ticketText) + '</pre></body></html>');
    frameDoc.close();

    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
    setTimeout(() => document.body.removeChild(printFrame), 1000);
  } catch (e) {
    alert(e.message);
  }
}

async function deleteRepair(id) {
  if (!confirm('Esta seguro de eliminar esta reparacion?')) return;
  try {
    await api.repairs.delete(id);
    closeRepairDetailModal();
    renderRepairs();
  } catch (e) {
    alert(e.message);
  }
}

console.log('Repairs loaded');
