let currentSettings = {};
let configDeviceTypes = [];
let configBrands = [];
let configModels = [];
let wooStatus = { connected: false };

async function renderSettings() {
  const content = document.getElementById('page-content');
  if (!content) return;
  
  if (!localStorage.getItem('token')) {
    content.innerHTML = '<div class="alert alert-warning">Debe iniciar sesión primero.</div>';
    return;
  }
  
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    if (!window.api || !window.api.settings) {
      content.innerHTML = '<div class="alert alert-warning">API no disponible. Recargue la página.</div>';
      return;
    }
    
    [currentSettings, configDeviceTypes, configBrands, configModels] = await Promise.all([
      window.api.settings.get(),
      window.api.deviceOptions.getDeviceTypes(),
      window.api.deviceOptions.getBrands(),
      window.api.deviceOptions.getModels()
    ]);
    
    try {
      wooStatus = await window.api.woocommerce.status();
    } catch (e) {
      wooStatus = { connected: false };
    }
    
    const brandOptions = configBrands.map(b => '<option value="' + b.id + '">' + b.name + '</option>').join('');
    const wooStatusBadge = wooStatus.connected 
      ? '<span class="badge badge-success">Conectado</span>' 
      : '<span class="badge badge-danger">No conectado</span>';
    const lastSync = wooStatus.last_sync ? new Date(wooStatus.last_sync).toLocaleString() : 'Nunca';
    
    content.innerHTML = 
      '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">Configuración del Negocio</h3></div>' +
      '<form id="settings-form">' +
      '<div class="form-group"><label for="setting-business-name">Nombre del Negocio</label><input type="text" id="setting-business-name" autocomplete="organization" value="' + (currentSettings.business_name || '') + '"></div>' +
      '<div class="form-group"><label for="setting-business-address">Dirección</label><input type="text" id="setting-business-address" autocomplete="address-level2" value="' + (currentSettings.business_address || '') + '"></div>' +
      '<div class="form-group"><label for="setting-business-phone">Teléfono</label><input type="text" id="setting-business-phone" autocomplete="tel" value="' + (currentSettings.business_phone || '') + '"></div>' +
      '<div class="form-group"><label for="setting-business-email">Email</label><input type="email" id="setting-business-email" autocomplete="email" value="' + (currentSettings.business_email || '') + '"></div>' +
      '<button type="button" class="btn btn-primary" onclick="saveSettings()">Guardar Configuración</button>' +
      '</form>' +
      '</div>' +
      
      '<div class="card" style="margin-top:20px;">' +
      '<div class="card-header"><h3 class="card-title">Integración WooCommerce ' + wooStatusBadge + '</h3></div>' +
      '<form id="woo-config-form">' +
      '<div class="form-group"><label for="woo-url">URL de la tienda</label><input type="url" id="woo-url" placeholder="https://mitienda.com" value="' + (wooStatus.store_url || '') + '"></div>' +
      '<div class="form-group"><label for="woo-key">Consumer Key</label><input type="text" id="woo-key" placeholder="ck_xxxxx" value=""></div>' +
      '<div class="form-group"><label for="woo-secret">Consumer Secret</label><input type="password" id="woo-secret" placeholder="cs_xxxxx" value=""></div>' +
      '<div class="form-group"><label for="woo-direction">Dirección de sincronización</label>' +
      '<select id="woo-direction">' +
      '<option value="both" ' + (wooStatus.sync_direction === 'both' ? 'selected' : '') + '>Bidireccional</option>' +
      '<option value="import" ' + (wooStatus.sync_direction === 'import' ? 'selected' : '') + '>Solo importar de WooCommerce</option>' +
      '<option value="export" ' + (wooStatus.sync_direction === 'export' ? 'selected' : '') + '>Solo exportar a WooCommerce</option>' +
      '</select></div>' +
      '<div class="form-group"><label><input type="checkbox" id="woo-autosync" ' + (wooStatus.auto_sync ? 'checked' : '') + '> Sincronización automática</label></div>' +
      '<button type="button" class="btn btn-secondary" onclick="testWooCommerce()">Probar conexión</button> ' +
      '<button type="button" class="btn btn-primary" onclick="saveWooConfig()">Guardar</button> ' +
      '<button type="button" class="btn btn-danger" onclick="disconnectWooCommerce()">Desconectar</button>' +
      '</form>' +
      '<div style="margin-top:15px;padding:10px;background:#f0f0f0;border-radius:5px;">' +
      '<p><strong>Última sincronización:</strong> ' + lastSync + '</p>' +
      '<button type="button" class="btn btn-success" onclick="syncWooCommerce()" ' + (!wooStatus.connected ? 'disabled' : '') + '>Sincronizar ahora</button>' +
      '</div>' +
      '<div id="woo-sync-result" style="margin-top:10px;"></div>' +
      '</div>' +
      
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:20px;">' +
      '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">Tipos de Dispositivos</h3></div>' +
      '<div class="form-group"><input type="text" id="new-device-type" placeholder="Nuevo tipo"><button class="btn btn-sm btn-primary" onclick="addDeviceType()">Agregar</button></div>' +
      '<div id="device-types-list">' + configDeviceTypes.map(t => '<div style="display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee;"><span>' + t.name + '</span><button class="btn btn-sm btn-danger" onclick="deleteDeviceType(' + t.id + ')">×</button></div>').join('') + '</div>' +
      '</div>' +
      
      '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">Marcas</h3></div>' +
      '<div class="form-group"><input type="text" id="new-brand" placeholder="Nueva marca"><button class="btn btn-sm btn-primary" onclick="addBrand()">Agregar</button></div>' +
      '<div id="brands-list">' + configBrands.map(b => '<div style="display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee;"><span>' + b.name + '</span><button class="btn btn-sm btn-danger" onclick="deleteBrand(' + b.id + ')">×</button></div>').join('') + '</div>' +
      '</div>' +
      
      '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">Modelos</h3></div>' +
      '<div class="form-group"><select id="model-brand-select" onchange="filterModels()"><option value="">Seleccione marca...</option>' + brandOptions + '</select></div>' +
      '<div class="form-group"><input type="text" id="new-model" placeholder="Nuevo modelo"><button class="btn btn-sm btn-primary" onclick="addModel()">Agregar</button></div>' +
      '<div id="models-list"><p style="color:#666;">Seleccione una marca para ver los modelos</p></div>' +
      '</div>' +
      '</div>';
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

async function saveWooConfig() {
  const data = {
    store_url: document.getElementById('woo-url').value,
    consumer_key: document.getElementById('woo-key').value,
    consumer_secret: document.getElementById('woo-secret').value,
    sync_direction: document.getElementById('woo-direction').value,
    auto_sync: document.getElementById('woo-autosync').checked
  };
  
  if (!data.store_url || !data.consumer_key || !data.consumer_secret) {
    alert('Complete todos los campos');
    return;
  }
  
  try {
    await window.api.woocommerce.config(data);
    alert('Configuración guardada');
    renderSettings();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function testWooCommerce() {
  const url = document.getElementById('woo-url').value;
  const key = document.getElementById('woo-key').value;
  const secret = document.getElementById('woo-secret').value;
  
  if (!url || !key || !secret) {
    alert('Complete todos los campos primero');
    return;
  }
  
  try {
    await window.api.woocommerce.config({ store_url: url, consumer_key: key, consumer_secret: secret, sync_direction: 'both' });
    const result = await window.api.woocommerce.test();
    if (result.success) {
      alert('Conexión exitosa con: ' + result.store);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  }
}

async function syncWooCommerce() {
  const resultDiv = document.getElementById('woo-sync-result');
  resultDiv.innerHTML = '<div style="margin:20px 0;"><p id="sync-status">Iniciando sincronización...</p>' +
    '<div style="background:#e2e8f0;border-radius:10px;height:20px;overflow:hidden;margin:10px 0;">' +
    '<div id="sync-progress-bar" style="background:#2563eb;height:100%;width:0%;transition:width 0.3s;"></div></div>' +
    '<p id="sync-percent" style="font-weight:bold;">0%</p>' +
    '<div id="sync-results"></div></div>';
  
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/woocommerce/sync', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            
            if (data.error) {
              resultDiv.innerHTML = '<div class="alert alert-danger">Error: ' + data.error + '</div>';
              return;
            }
            
            if (data.status) {
              document.getElementById('sync-status').textContent = data.status;
            }
            
            if (data.progress !== undefined) {
              document.getElementById('sync-progress-bar').style.width = data.progress + '%';
              document.getElementById('sync-percent').textContent = data.progress + '%';
            }
            
            if (data.done) {
              resultDiv.innerHTML = '<div class="alert alert-success">' +
                '<p><strong>Sincronización completada:</strong></p>' +
                '<p>Importados: ' + (data.results?.imported || 0) + '</p>' +
                '<p>Exportados: ' + (data.results?.exported || 0) + '</p>' +
                '<p>Actualizados: ' + (data.results?.updated || 0) + '</p>' +
                (data.results?.errors?.length ? '<p>Errores: ' + data.results.errors.join(', ') + '</p>' : '') +
                '</div>';
            }
          } catch (e) {
            console.log('Parse error:', e);
          }
        }
      }
    }
  } catch (e) {
    resultDiv.innerHTML = '<div class="alert alert-danger">Error: ' + e.message + '</div>';
  }
}

async function disconnectWooCommerce() {
  if (!confirm('¿Desconectar WooCommerce? Esta acción no elimina los productos sincronizados.')) return;
  
  try {
    await window.api.woocommerce.disconnect();
    alert('WooCommerce desconectado');
    renderSettings();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function saveSettings() {
  const data = {
    business_name: document.getElementById('setting-business-name').value,
    business_address: document.getElementById('setting-business-address').value,
    business_phone: document.getElementById('setting-business-phone').value,
    business_email: document.getElementById('setting-business-email').value
  };
  
  try {
    await window.api.settings.update(data);
    currentSettings = data;
    window.businessName = data.business_name;
    const sidebarName = document.getElementById('sidebar-business-name');
    if (sidebarName) {
      sidebarName.textContent = data.business_name;
    }
    alert('Configuración guardada');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function addDeviceType() {
  const name = document.getElementById('new-device-type').value.trim();
  if (!name) return;
  try {
    await window.api.deviceOptions.addDeviceType(name);
    document.getElementById('new-device-type').value = '';
    renderSettings();
  } catch (e) { alert(e.message); }
}

async function deleteDeviceType(id) {
  if (!confirm('¿Eliminar este tipo?')) return;
  try {
    await window.api.deviceOptions.deleteDeviceType(id);
    renderSettings();
  } catch (e) { alert(e.message); }
}

async function addBrand() {
  const name = document.getElementById('new-brand').value.trim();
  if (!name) return;
  try {
    await window.api.deviceOptions.addBrand(name);
    document.getElementById('new-brand').value = '';
    renderSettings();
  } catch (e) { alert(e.message); }
}

async function deleteBrand(id) {
  if (!confirm('¿Eliminar esta marca?')) return;
  try {
    await window.api.deviceOptions.deleteBrand(id);
    renderSettings();
  } catch (e) { alert(e.message); }
}

async function addModel() {
  console.log('addModel called');
  const nameInput = document.getElementById('new-model');
  const brandSelect = document.getElementById('model-brand-select');
  const name = nameInput ? nameInput.value.trim() : '';
  const brand_id = brandSelect && brandSelect.value ? parseInt(brandSelect.value) : null;
  console.log('name:', name, 'brand_id:', brand_id);
  if (!name) {
    alert('Ingrese un nombre para el modelo');
    return;
  }
  try {
    console.log('Calling API...');
    await window.api.deviceOptions.addModel({ name: name, brand_id: brand_id });
    console.log('Model added successfully');
    if (nameInput) nameInput.value = '';
    
    const [newSettings, newTypes, newBrands, newModels] = await Promise.all([
      window.api.settings.get(),
      window.api.deviceOptions.getDeviceTypes(),
      window.api.deviceOptions.getBrands(),
      window.api.deviceOptions.getModels()
    ]);
    currentSettings = newSettings;
    configDeviceTypes = newTypes;
    configBrands = newBrands;
    configModels = newModels;
    
    renderSettings();
  } catch (e) { 
    console.error('Error adding model:', e);
    alert(e.message); 
  }
}

async function deleteModel(id) {
  if (!confirm('¿Eliminar este modelo?')) return;
  try {
    await window.api.deviceOptions.deleteModel(id);
    renderSettings();
  } catch (e) { alert(e.message); }
}

function filterModels() {
  const brandSelect = document.getElementById('model-brand-select');
  const brand_id = brandSelect ? brandSelect.value : '';
  if (!brand_id) {
    document.getElementById('models-list').innerHTML = '<p style="color:#666;">Seleccione una marca para ver los modelos</p>';
    return;
  }
  const filtered = configModels.filter(m => m.brand_id === parseInt(brand_id));
  document.getElementById('models-list').innerHTML = filtered.map(m => '<div style="display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee;"><span>' + m.name + '</span><button class="btn btn-sm btn-danger" onclick="deleteModel(' + m.id + ')">×</button></div>').join('');
}

console.log('Settings loaded');
