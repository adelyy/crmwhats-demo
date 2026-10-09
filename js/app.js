// Prototipo del CRM de WhatsApp. Sin servidor: todo vive en memoria y se pierde al recargar.
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ahora = () => new Date().toTimeString().slice(0, 5);

const E = {
  ruta: 'login', rol: 'A', movil: false, usuario: 'u1',
  numero: 'todos', pest: 'todas', busca: '', verFiltros: false,
  embudo: 'b1', rep: { pre: '7', desde: '', hasta: '' }, tk: { pre: 'todo', desde: '', hasta: '' }, tb: { pre: 'todo', desde: '', hasta: '' },
  f: { tags: [], embudo: '', etapa: '', resp: '', campana: '', misTickets: false, especial: false },
  conv: 'v1', panel: 'lista', pestTickets: 'Abierto', buscaContacto: ''
};
const USUARIO_POR_ROL = { A: 'u1', S: 'u2', G: 'u3', P: 'u1' };

const U = id => DB.usuarios.find(u => u.id === id);
const C = id => DB.contactos.find(c => c.id === id);
const N = id => DB.numeros.find(n => n.id === id);
const TB = id => DB.embudos.find(b => b.id === id);
const ET = id => DB.embudos.flatMap(b => b.etapas).find(e => e.id === id);
// Tarjetas de un contacto. Ningún embudo se asigna por defecto: si no tiene tarjetas, no está en ninguno.
const posDe = c => DB.posiciones.filter(p => p.c === c.id);
const chipTab = c => { const ps = posDe(c); if (!ps.length) return ''; const e = ET(ps[0].e), o = ps.slice(1); return `<span class="mini" style="--c:${e.c}" title="Embudo ${esc(TB(ps[0].b).n)}">${esc(TB(ps[0].b).n.replace('Campaña · ', ''))} · ${esc(e.n)}</span>` + (o.length ? ` <span class="mini gris" title="${esc(o.map(p => TB(p.b).n + ': ' + ET(p.e).n).join(' · '))}">+${o.length}</span>` : ''); };
// Palabras clave de los embudos: sin mayúsculas ni acentos, y palabra completa ("pago" no coincide con "pagos").
const normal = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tieneClave = (texto, clave) => { const k = normal(clave).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return !!k && new RegExp('(^|[^a-z0-9])' + k + '([^a-z0-9]|$)').test(normal(texto)); };
function aplicarClaves(v, texto) {
  if (!v.contacto) return [];
  const c = C(v.contacto), hechos = [];
  for (const b of DB.embudos.filter(x => x.tipo !== 'tickets' && (x.claves || []).length)) {
    const clave = b.claves.find(k => tieneClave(texto, k));
    if (b.numero && b.numero !== v.numero) continue; // embudo limitado a otro número
    const camp = b.campana && DB.campanas.find(x => x.id === b.campana);
    if (camp && camp.tipo === 'Entrada' && camp.inicio && estadoEntrada(camp) !== 'Activa') continue; // fuera de sus fechas no clasifica
    if (!clave || posDe(c).some(p => p.b === b.id)) continue; // si ya está en el embudo no se regresa a la primera etapa
    DB.posiciones.push({ c: c.id, b: b.id, e: b.etapas[0].id, m: 0, dias: 0, origen: 'clave', clave });
    if (b.campana) { v.campana = b.campana; const k = DB.campanas.find(x => x.id === b.campana); if (k) k.respuestas++; } // la conversación queda ligada a la campaña
    v.msgs.push({ de: 's', t: `Se agregó solo al embudo ${b.n}, etapa ${b.etapas[0].n}, por la palabra «${clave}»`, h: ahora() });
    hechos.push(b.n);
  }
  return hechos;
}
const TAGS = () => DB.gruposTags.flatMap(g => g.tags);
const TAG = id => TAGS().find(t => t.id === id);
const CONV = () => DB.conversaciones.find(v => v.id === E.conv);
const nombreConv = v => v.grupo || C(v.contacto).nombre;
const iniciales = n => n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* ---------- Iconos ---------- */
const TRAZOS = {
  menu: 'M4 6h16M4 12h16M4 18h16', chat: 'M4 5h16v11H9l-5 4z', cols: 'M4 4h5v16H4zM10.5 4h5v11h-5zM17 4h3v7h-3z', users: 'M8 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 100-6M18 15c2 .5 4 2 4 5',
  ticket: 'M4 7h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4zM10 7v12', mega: 'M3 10v4l11 5V5zM14 9a3 3 0 010 6M6 15v4h3', lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8', tel: 'M7 3h10v18H7zM11 18h2', plant: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', rayo: 'M13 3L5 14h6l-1 7 8-11h-6z',
  robot: 'M5 9h14v10H5zM12 9V5M9 14h.01M15 14h.01M3 13v3M21 13v3', tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01', stop: 'M12 3a9 9 0 100 18 9 9 0 000-18zM6 6l12 12', plan: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  edif: 'M4 21V5h10v16M14 10h6v11M8 9h2M8 13h2M8 17h2', caja: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8', perfil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  mas: 'M12 5v14M5 12h14', enviar: 'M4 12l16-8-6 16-3-7z', mic: 'M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4', emoji: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14c1 1.5 6 1.5 7 0M9 9.5h.01M15 9.5h.01',
  filtro: 'M4 5h16l-6 8v6l-4-2v-4z', atras: 'M15 5l-7 7 7 7', reloj: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', estrella: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5h.01', grupo: 'M9 10a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M17 8v6M14 11h6'
};
const ico = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${TRAZOS[n] || ''}"/></svg>`;

/* ---------- Menú y permisos ---------- */
const MENU = [
  { sec: 'Operación', items: [
    { r: 'bandeja', n: 'Bandeja', i: 'chat', roles: 'ASG', movil: true },
    { r: 'embudo', n: 'Embudos', i: 'cols', roles: 'ASG', movil: true },
    { r: 'contactos', n: 'Contactos', i: 'users', roles: 'ASG', movil: true },
    { r: 'tickets', n: 'Tickets', i: 'ticket', roles: 'ASG', movil: true },
    { r: 'campanas', n: 'Campañas', i: 'mega', roles: 'AS' },
    { r: 'listas', n: 'Listas de difusión', i: 'lista', roles: 'AS' },
    { r: 'reportes', n: 'Reportes', i: 'chart', roles: 'ASG' }] },
  { sec: 'Configuración', items: [
    { r: 'numeros', n: 'Números', i: 'tel', roles: 'A' },
    { r: 'plantillas', n: 'Plantillas', i: 'plant', roles: 'AS' },
    { r: 'respuestas', n: 'Respuestas rápidas', i: 'rayo', roles: 'AS' },
    { r: 'automaticos', n: 'Mensajes automáticos', i: 'robot', roles: 'AS' },
    { r: 'tags', n: 'Tags y embudos', i: 'tag', roles: 'A' },
    { r: 'bajas', n: 'Bajas', i: 'stop', roles: 'AS' },
    { r: 'usuarios', n: 'Usuarios', i: 'users', roles: 'A' },
    { r: 'plan', n: 'Mi plan', i: 'plan', roles: 'A' }] },
  { sec: 'Plataforma', items: [
    { r: 'empresas', n: 'Empresas', i: 'edif', roles: 'P' },
    { r: 'paquetes', n: 'Paquetes', i: 'caja', roles: 'P' },
    { r: 'numerosPlat', n: 'Números conectados', i: 'tel', roles: 'P' }] },
  { sec: '', items: [{ r: 'perfil', n: 'Perfil', i: 'perfil', roles: 'ASGP', movil: true, oculto: true }] }
];
const ITEMS = MENU.flatMap(s => s.items);
const permite = it => it && it.roles.includes(E.rol);
const puede = letras => letras.includes(E.rol);

function menu() {
  const yo = U(E.usuario);
  const secciones = MENU.map(s => {
    const its = s.items.filter(it => permite(it) && !it.oculto);
    if (!its.length) return '';
    return `<div class="m-sec">${s.sec}</div>` + its.map(it =>
      `<a class="m-item ${E.ruta === it.r ? 'activo' : ''}" data-accion="ir" data-ruta="${it.r}" title="${it.n}">${ico(it.i)}<span>${it.n}</span>${it.r === 'bandeja' ? `<b class="globo">${totalNoLeidos()}</b>` : ''}</a>`).join('');
  }).join('');
  return `<nav class="menu ${E.menuCol ? 'col' : ''}">
    <div class="marca"><button class="m-col" data-accion="colMenu" title="${E.menuCol ? 'Mostrar el menú completo' : 'Dejar solo los iconos'}" aria-label="Contraer o expandir el menú">${ico('menu')}</button><span class="logo">E</span><div><strong>Enlaza CRM</strong><small>${E.rol === 'P' ? 'Plataforma' : esc(DB.empresa.nombre)}</small></div></div>
    <div class="m-lista">${secciones}</div>
    <a class="m-yo" data-accion="ir" data-ruta="perfil" title="${esc(yo.nombre)} · Perfil"><span class="avatar">${yo.ini}</span><div><strong>${esc(yo.nombre)}</strong><small><i class="punto ${yo.disp ? 'ok' : ''}"></i>${yo.disp ? 'Disponible' : 'No disponible'}</small></div></a>
  </nav>`;
}
function navMovil() {
  const its = E.rol === 'P' ? ['perfil'] : ['bandeja', 'tickets', 'embudo', 'contactos', 'perfil'];
  return `<nav class="nav-movil">${its.map(r => { const it = ITEMS.find(i => i.r === r); return `<a class="${E.ruta === r ? 'activo' : ''}" data-accion="ir" data-ruta="${r}">${ico(it.i)}<span>${it.n}</span></a>`; }).join('')}</nav>`;
}

/* ---------- Piezas comunes ---------- */
const chip = (t, tono = '') => `<span class="chip ${tono}">${esc(t)}</span>`;
const TONOS = { Conectado: 'verde', Aprobada: 'verde', Activa: 'verde', Enviada: 'verde', Cerrado: 'gris', 'En revisión': 'ambar', Desconectado: 'rojo', Programada: 'azul', Cancelada: 'gris', Finalizada: 'gris', Activo: 'verde', Programado: 'azul', Finalizado: 'gris', Apagado: 'gris', Enviando: 'azul', 'En prueba': 'azul', 'En proceso': 'ambar', Abierto: 'rojo', Rechazada: 'rojo', 'En pausa': 'ambar', Suspendida: 'rojo', Alta: 'verde', Media: 'ambar' };
const estadoChip = t => chip(t, TONOS[t] || 'gris');
const pagina = (t, sub, acc, cuerpo) => `<div class="pagina"><header class="p-cab"><div><h1>${t}</h1><p>${sub}</p></div><div class="p-acc">${acc || ''}</div></header>${cuerpo}</div>`;
const tabla = (cols, filas) => `<div class="tabla-caja"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map(f => `<tr ${f.attr || ''}>${f.c.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="vacio">Sin registros</td></tr>`}</tbody></table></div>`;
const btn = (t, accion, clase = '', extra = '') => `<button class="btn ${clase}" data-accion="${accion}" ${extra}>${t}</button>`;

function aviso(t) {
  const d = document.createElement('div'); d.className = 'aviso'; d.textContent = t;
  $('#avisos').appendChild(d); setTimeout(() => d.remove(), 3200);
}
function abrirModal(titulo, cuerpo, pie = '', ancho = '') {
  $('#modal').className = '';
  $('#modal').innerHTML = `<div class="m-fondo" data-accion="cerrarModal"></div><div class="m-caja ${ancho}"><header><h2>${titulo}</h2><button class="x" data-accion="cerrarModal">×</button></header><div class="m-cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ''}</div>`;
}
const cerrarModal = () => { $('#modal').className = 'oculto'; $('#modal').innerHTML = ''; };

// Colores que se pueden elegir para una etapa: pocos y probados, para que el texto siempre se lea.
const PALETA = [['#2563eb', 'Azul'], ['#0e7490', 'Turquesa'], ['#047857', 'Verde'], ['#b45309', 'Ámbar'], ['#be123c', 'Rojo'], ['#c026d3', 'Rosa'], ['#7c3aed', 'Morado'], ['#64748b', 'Gris']];
// Campos que dependen de otra opción: se ocultan (no se desactivan) cuando no aplican y conservan lo escrito.
const siHtml = (html, campo, valor) => `<div data-si-campo="${campo}" data-si-valor="${valor}">${html}</div>`;
function aplicarSi() {
  document.querySelectorAll('#modal form [data-si-campo]').forEach(el => {
    const ctrl = el.closest('form').elements[el.dataset.siCampo], v = ctrl ? String(ctrl.value) : '';
    el.classList.toggle('oculto', !el.dataset.siValor.split('|').some(x => v.startsWith(x)));
  });
}
let alGuardar = null;
function formModal(titulo, campos, cb, textoBoton = 'Guardar') {
  alGuardar = cb;
  const campoHtml = c => {
    if (c.tipo === 'paleta') return `<div class="campo"><span>${c.et}</span><div class="paleta"><label class="auto"><input type="radio" name="${c.id}" value="" checked><i>Automático</i></label>${PALETA.map(p => `<label title="${p[1]}"><input type="radio" name="${c.id}" value="${p[0]}"><i style="--c:${p[0]}"></i><b>${p[1]}</b></label>`).join('')}</div></div>`;
    let ctrl;
    if (c.tipo === 'select') ctrl = `<select name="${c.id}">${c.ops.map(o => `<option ${o === c.valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (c.tipo === 'area') ctrl = `<textarea name="${c.id}" rows="3" placeholder="${esc(c.ph || '')}">${esc(c.valor || '')}</textarea>`;
    else if (c.tipo === 'nota') return `<p class="nota">${c.et}</p>`;
    else ctrl = `<input name="${c.id}" type="${c.tipo || 'text'}" value="${esc(c.valor || '')}" placeholder="${esc(c.ph || '')}">`;
    return `<label class="campo"><span>${c.et}</span>${ctrl}</label>`;
  };
  const cuerpo = campos.map(c => c.si ? siHtml(campoHtml(c), c.si[0], c.si[1]) : campoHtml(c)).join('');
  abrirModal(titulo, `<form id="formGen">${cuerpo}</form>`, btn('Cancelar', 'cerrarModal') + btn(textoBoton, 'guardarForm', 'primario'));
  aplicarSi();
}

/* ---------- Bandeja ---------- */
const ultimoMsg = v => [...v.msgs].reverse().find(m => m.de !== 's');
const sinResponder = v => v.estado === 'abierta' && ultimoMsg(v)?.de === 'c';
const ticketsAbiertosDe = v => DB.tickets.filter(k => k.conv === v.id && k.estado !== 'Cerrado').length;
const usaVentana = v => N(v.numero).tipo !== 'QR';
function convsVisibles() {
  const yo = U(E.usuario);
  return DB.conversaciones.filter(v => yo.numeros.includes(v.numero) && (E.rol !== 'G' || !v.resp || v.resp === yo.id));
}
const totalNoLeidos = () => convsVisibles().reduce((s, v) => s + v.noLeidos, 0);
function convsFiltradas() {
  const q = E.busca.trim().toLowerCase(), f = E.f;
  return convsVisibles().filter(v => {
    const c = v.contacto ? C(v.contacto) : null;
    if (E.numero !== 'todos' && v.numero !== E.numero) return false;
    if (E.pest === 'contickets') { if (!DB.tickets.some(k => k.conv === v.id && k.estado !== 'Cerrado' && (!f.misTickets || k.asignado === E.usuario))) return false; }
    else if (E.pest === 'cerradas' ? v.estado === 'abierta' : v.estado !== 'abierta') return false;
    if (E.pest === 'sinleer' && !v.noLeidos) return false;
    if (E.pest === 'sinresp' && !sinResponder(v)) return false;
    if (E.pest === 'mias' && v.resp !== E.usuario) return false;
    if (E.pest === 'grupos' && !v.grupo) return false;
    if (q && !(nombreConv(v).toLowerCase().includes(q) || (c && c.tel.replace(/\s/g, '').includes(q.replace(/\s/g, ''))))) return false;
    if (f.tags.length && !f.tags.some(t => v.tags.includes(t) || (c && c.tags.includes(t)))) return false;
    if ((f.embudo || f.etapa) && !(c && posDe(c).some(p => (!f.embudo || p.b === f.embudo) && (!f.etapa || p.e === f.etapa)))) return false;
    if (f.resp && (f.resp === 'nadie' ? v.resp : v.resp !== f.resp)) return false;
    if (f.campana && v.campana !== f.campana) return false;
    if (f.especial && !(c && c.especial)) return false;
    return true;
  });
}
const numFiltros = () => E.f.tags.length + ['embudo', 'etapa', 'resp', 'campana'].filter(k => E.f[k]).length + (E.f.especial ? 1 : 0);

function indicadores() {
  const vis = convsVisibles();
  const tickets = DB.tickets.filter(k => k.estado !== 'Cerrado').length;
  const d = [['Recibidos hoy', 238, ''], ['Enviados hoy', 221, ''], ['Sin responder', vis.filter(sinResponder).length, 'rojo'], ['Tickets abiertos', tickets, 'ambar'],
    ['Marketing', '12 · $0.52', 'azul'], ['Utilidad', '185 · $1.48', 'verde'], ['Servicio', '0 · $0', 'gris']];
  return `<div class="indicadores">${d.map(x => `<div class="ind ${x[2]}"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}</div>`;
}
function filaConv(v) {
  const c = v.contacto ? C(v.contacto) : null, u = ultimoMsg(v), r = v.resp ? U(v.resp) : null;
  const previa = (u.de === 'c' ? '' : 'Tú: ') + u.t;
  return `<a class="conv ${v.id === E.conv ? 'activa' : ''}" data-accion="abrirConv" data-id="${v.id}">
    <span class="avatar ${v.grupo ? 'grupo' : ''}">${v.grupo ? ico('grupo') : iniciales(c.nombre)}</span>
    <div class="c-medio">
      <div class="c-nombre">${esc(nombreConv(v))}${c && c.especial ? `<i class="estrella">${ico('estrella')}</i>` : ''}</div>
      <div class="c-previa">${esc(previa)}</div>
      <div class="c-chips">${c ? chipTab(c) : ''}${ticketsAbiertosDe(v) ? '<span class="mini" style="--c:#be123c">Ticket abierto</span>' : ''}${v.estado === 'inactividad' ? '<span class="mini gris">Cerrada · inactividad</span>' : ''}${v.estado === 'cerrada' ? '<span class="mini gris">Cerrada</span>' : ''}<span class="mini gris">${N(v.numero).nombre}</span></div>
    </div>
    <div class="c-der"><small>${v.hora}</small>${v.noLeidos ? `<b class="globo">${v.noLeidos}</b>` : ''}${v.espera ? `<span class="espera">${ico('reloj')}${v.espera}</span>` : ''}<span class="resp ${r ? '' : 'nadie'}" title="${r ? esc(r.nombre) : 'Sin asignar'}">${r ? r.ini : '+'}</span></div>
  </a>`;
}
const ticketMasViejo = v => Math.min(...DB.tickets.filter(k => k.conv === v.id && k.estado !== 'Cerrado').map(k => k.id));
const filasConv = () => { const l = convsFiltradas(); if (E.pest === 'contickets') l.sort((a, b) => ticketMasViejo(a) - ticketMasViejo(b)); return l.length ? l.map(filaConv).join('') : '<div class="vacio">No hay conversaciones con estos filtros.<br><a data-accion="limpiar">Limpiar filtros</a></div>'; };

function panelFiltros() {
  const f = E.f;
  const sel = (k, et, ops) => `<label class="campo"><span>${et}</span><select data-cambio="filtro" data-k="${k}"><option value="">Todos</option>${ops.map(o => `<option value="${o[0]}" ${f[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  return `<div class="filtros">
    ${DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)}</h4>${g.tags.map(t => `<label class="check"><input type="checkbox" data-cambio="filtroTag" value="${t.id}" ${f.tags.includes(t.id) ? 'checked' : ''}>${esc(t.n)}</label>`).join('')}</div>`).join('')}
    <div class="f-fila">${sel('embudo', 'Embudo', DB.embudos.filter(b => b.tipo !== 'tickets').map(b => [b.id, b.n]))}${sel('etapa', 'Etapa del embudo', (f.embudo ? TB(f.embudo).etapas : []).map(e => [e.id, e.n]))}${sel('resp', 'Responsable', [['nadie', 'Sin asignar'], ...DB.usuarios.map(u => [u.id, u.nombre])])}${sel('campana', 'Campaña', DB.campanas.map(k => [k.id, k.nombre]))}</div>
    <div class="f-fila"><label class="check"><input type="checkbox" data-cambio="filtroBool" data-k="especial" ${f.especial ? 'checked' : ''}>Cliente especial</label><a class="limpiar" data-accion="limpiar">Limpiar todo</a></div>
  </div>`;
}
function vBandeja() {
  const yo = U(E.usuario), v = CONV();
  const pests = [['todas', 'Todas'], ['sinleer', 'Sin leer'], ['sinresp', 'Sin responder'], ['contickets', 'Con ticket'], ['mias', 'Mías'], ['grupos', 'Grupos'], ['cerradas', 'Cerradas']];
  return `<div class="bandeja panel-${E.panel}">
    ${indicadores()}
    <div class="b-cuerpo">
      <section class="b-lista">
        <div class="l-cab">
          <select data-cambio="numero"><option value="todos">Todos mis números</option>${DB.numeros.filter(n => yo.numeros.includes(n.id)).map(n => `<option value="${n.id}" ${E.numero === n.id ? 'selected' : ''}>${esc(n.nombre)} · ${n.tel}</option>`).join('')}</select>
          <div class="l-busca"><input id="busca" placeholder="Buscar por nombre o teléfono" value="${esc(E.busca)}"><button class="icono ${E.verFiltros ? 'activo' : ''}" data-accion="toggleFiltros" title="Filtros">${ico('filtro')}${numFiltros() ? `<b class="globo">${numFiltros()}</b>` : ''}</button></div>
          <div class="pests">${pests.map(p => `<button class="${E.pest === p[0] ? 'activo' : ''}" data-accion="pest" data-p="${p[0]}">${p[1]}${p[0] === 'contickets' ? ` <b>${convsVisibles().filter(ticketsAbiertosDe).length}</b>` : ''}</button>`).join('')}</div>
          ${E.pest === 'contickets' ? `<div class="f-fila sub-pest"><label class="check"><input type="checkbox" data-cambio="filtroBool" data-k="misTickets" ${E.f.misTickets ? 'checked' : ''}>Solo tickets asignados a mí</label><small>Primero el ticket más antiguo</small></div>` : ''}
          ${E.verFiltros ? panelFiltros() : ''}
        </div>
        <div class="convs" id="listaConvs">${filasConv()}</div>
        <div class="l-pie">${btn(ico('mas') + ' Nueva conversación', 'nuevaConv', 'primario ancho')}</div>
      </section>
      <section class="b-chat">${v ? chat(v) : '<div class="vacio">Elige una conversación</div>'}</section>
      <aside class="b-detalle" id="detalle">${v ? detalle(v) : ''}</aside>
    </div>
  </div>`;
}

const PALOMAS = { enviado: '✓', entregado: '✓✓', leido: '<i class="leido">✓✓</i>', fallido: '<i class="fallo">! No enviado</i>' };
function burbuja(m) {
  if (m.de === 's') return `<div class="sistema"><span>${esc(m.t)} · ${m.h}</span></div>`;
  const mio = m.de !== 'c';
  const quien = m.de === 'a' ? U(m.por).nombre : m.de === 'auto' ? 'Mensaje automático' : m.de === 'camp' ? 'Campaña' : (m.autor || '');
  let cuerpo = esc(m.t);
  if (m.tipo === 'audio') cuerpo = `<div class="adj">${ico('mic')}<div class="onda"></div><span>${esc(m.t.split('·')[1] || '0:08')}</span></div>`;
  if (m.tipo === 'doc' || m.tipo === 'imagen') cuerpo = `<div class="adj">${ico('plant')}<span>${esc(m.t)}</span></div>`;
  if (m.tipo === 'plantilla') cuerpo = `<small class="b-tipo">Plantilla</small>${m.medio ? `<div class="pl-medio">${esc(m.medio)}</div>` : ''}${m.enc ? `<strong class="pl-enc">${esc(m.enc)}</strong>` : ''}${m.oferta ? `<div class="pl-oferta"><b>${esc(m.oferta)}</b></div>` : ''}${esc(m.t)}${m.nTarjetas ? `<small class="pl-pie">Carrusel de ${m.nTarjetas} tarjetas</small>` : ''}${(m.botones || []).map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}`;
  return `<div class="msg ${mio ? 'mio' : 'suyo'} ${m.de}">${quien ? `<small class="b-quien">${esc(quien)}</small>` : ''}<div>${cuerpo}</div><span class="b-hora">${m.h} ${mio ? PALOMAS[m.est] || '' : ''}</span></div>`;
}
function textoVentana(v) {
  if (!usaVentana(v)) return '<span class="ventana gris">Número no oficial · sin ventana</span>';
  if (v.ventana <= 0) return '<span class="ventana cerrada">Ventana cerrada · solo plantillas</span>';
  return `<span class="ventana ${v.ventana < 60 ? "porcerrar" : ""}">Ventana abierta · quedan ${Math.floor(v.ventana / 60)} h ${v.ventana % 60} min de 24 h</span>`;
}
const textoGratis = v => v.gratis > 0 ? `<span class="ventana gratis">Entró por anuncio · plantillas gratis ${Math.floor(v.gratis / 60)} h más</span>` : "";
function redaccion(v) {
  if (v.estado !== 'abierta') return `<div class="bloqueo"><span>Esta conversación está cerrada${v.estado === 'inactividad' ? ' por inactividad' : ''}. Se reabre sola cuando el cliente escriba.</span>${btn('Reabrir', 'reabrir')}</div>`;
  if (usaVentana(v) && v.ventana <= 0) return `<div class="bloqueo"><span><strong>Ventana cerrada.</strong> Pasaron más de 24 h desde el último mensaje del cliente, así que no puedes escribirle libremente. La única forma de responderle es con una plantilla aprobada; cuando conteste, la ventana se abre otra vez.</span>${btn('Responder con plantilla', 'plantilla', 'primario')}</div>`;
  return `<div class="redaccion">
    <button class="icono" data-accion="menuMas" title="Adjuntar">${ico('mas')}</button>
    <button class="icono" data-accion="emoji" title="Emoji">${ico('emoji')}</button>
    <textarea id="texto" rows="1" placeholder="Escribe un mensaje… ( / para respuestas rápidas )"></textarea>
    <button class="btn chico" data-accion="plantilla" title="Responder con plantilla aprobada">${ico('plant')} Plantilla</button>
    <button class="icono" data-accion="voz" title="Nota de voz">${ico('mic')}</button>
    <button class="icono enviar" data-accion="enviar" title="Enviar">${ico('enviar')}</button>
  </div>`;
}
function chat(v) {
  const c = v.contacto ? C(v.contacto) : null, r = v.resp ? U(v.resp) : null;
  return `<header class="ch-cab">
      <button class="icono solo-movil" data-accion="panel" data-p="lista">${ico('atras')}</button>
      <span class="avatar ${v.grupo ? 'grupo' : ''}">${v.grupo ? ico('grupo') : iniciales(c.nombre)}</span>
      <div class="ch-quien"><strong>${esc(nombreConv(v))}</strong><small>${c ? c.tel : 'Grupo'} · por ${esc(N(v.numero).nombre)}</small></div>
      <div class="ch-acc">
        <button class="pastilla ${r ? '' : 'nadie'}" data-accion="asignar">${r ? `<b>${r.ini}</b>${esc(r.nombre)}` : '+ Sin asignar'}</button>
        ${v.estado === 'abierta' ? btn('Finalizar', 'finalizar', 'peligro chico') : ''}
        <button class="icono solo-movil" data-accion="panel" data-p="detalle">${ico('info')}</button>
      </div>
    </header>
    <div class="ch-sub"><span class="ch-ventanas">${textoVentana(v)}${textoGratis(v)}</span><a data-accion="simular">Simular mensaje del cliente</a></div>
    <div class="msgs" id="msgs">${v.msgs.map(burbuja).join('')}</div>
    ${redaccion(v)}`;
}
// Línea que explica qué significa el permiso del contacto para las campañas.
function textoPermiso(c) {
  if (c.consent === 'baja') { const b = DB.bajas.find(x => soloDig(x.tel) === soloDig(c.tel)); return `<small class="nota">${b ? `Desde el ${esc(b.fecha)}, ${{ 'Botón': 'con el botón de baja', 'Palabra BAJA': 'al escribir BAJA', 'Manual': 'lo dio de baja un usuario', 'Rechazo de Meta': 'Meta rechazó el envío' }[b.origen] || esc(b.origen)}${b.campana && b.campana !== '—' ? ', en la campaña ' + esc(b.campana) : ''}. ` : ''}No recibe campañas; sí puedes atenderlo cuando escriba.</small>`; }
  if (c.consent === 'sin') return '<small class="nota">No ha dicho ni que sí ni que no. Las campañas sí le llegan; solo quedan fuera quienes se dieron de baja.</small>';
  return '<small class="nota">Aceptó recibir campañas.</small>';
}
function detalle(v) {
  if (v.grupo) return `<header class="d-cab"><button class="icono solo-movil" data-accion="panel" data-p="chat">${ico('atras')}</button><h3>Grupo</h3></header><div class="d-sec"><h4>${esc(v.grupo)}</h4><p class="nota">Grupo oficial por Cloud API: máximo 8 participantes, ingreso por enlace de invitación.</p><p>Participantes: Mariana Solís, Lucía Fernández, Daniel Ochoa.</p></div>`;
  const c = C(v.contacto), tickets = DB.tickets.filter(k => k.contacto === c.id);
  const todos = [...new Set([...c.tags, ...v.tags])];
  const consent = { otorgado: ['Acepta campañas', 'verde'], baja: ['Se dio de baja', 'rojo'], sin: ['Sin permiso registrado', 'gris'] }[c.consent];
  return `<header class="d-cab"><button class="icono solo-movil" data-accion="panel" data-p="chat">${ico('atras')}</button><h3>Detalle</h3></header>
    <div class="d-sec centro"><span class="avatar grande">${iniciales(c.nombre)}</span><h4>${esc(c.nombre)}${c.especial ? ' ★' : ''}</h4><small>${c.tel}${c.correo ? ' · ' + esc(c.correo) : ''}</small><div>${chipTipo(c)}</div></div>
    <div class="d-sec"><h5>Embudos ${btn('+ Agregar a embudo', 'agregarEmbudo', 'enlace')}</h5>${posDe(c).map(p => `<div class="d-tab"><small>${esc(TB(p.b).n)}</small><div class="d-fila"><select data-cambio="etapa" data-b="${p.b}" data-id="${c.id}">${TB(p.b).etapas.map(e => `<option value="${e.id}" ${p.e === e.id ? 'selected' : ''}>${e.n}</option>`).join('')}</select><a class="quitar" data-accion="quitarEmbudo" data-b="${p.b}" title="Quitar de este embudo">×</a></div>${p.origen === 'clave' ? `<small class="nota">Entró solo por la palabra «${esc(p.clave)}»</small>` : ''}</div>`).join('') || '<small class="nota">No está en ningún embudo. Agrégalo, o entrará solo si escribe una palabra clave de algún embudo.</small>'}</div>
    <div class="d-sec"><h5>Tags ${btn('+ Tag', 'tagModal', 'enlace')}</h5><div class="tags">${todos.length ? todos.map(t => `<span class="tag" style="--c:${TAG(t).c}">${esc(TAG(t).n)}<i data-accion="quitarTag" data-id="${t}">×</i></span>`).join('') : '<small class="nota">Sin tags</small>'}</div></div>
    <div class="d-sec"><h5>Tickets ${puede('AS') ? btn('+ Levantar ticket', 'ticketModal', 'enlace') : ''}</h5>${tickets.length ? tickets.map(k => `<a class="d-ticket" data-accion="verTicket" data-id="${k.id}"><span>#${k.id} · ${esc(k.motivo)}</span>${estadoChip(k.estado)}</a>`).join('') : '<small class="nota">Sin tickets</small>'}</div>
    <div class="d-sec"><h5>Notas internas ${btn('+ Nota', 'notaModal', 'enlace')}</h5>${c.notas.length ? c.notas.map(n => `<div class="d-nota">${esc(n.t)}<small>${esc(U(n.por).nombre)} · ${n.f}</small></div>`).join('') : '<small class="nota">Sin notas</small>'}</div>
    <div class="d-sec"><h5>Permiso para campañas</h5><div class="d-fila">${chip(consent[0], consent[1])}${c.consent !== 'baja' ? btn('Dar de baja', 'baja', 'enlace rojo') : ''}</div>${textoPermiso(c)}${v.campana ? `<small class="nota">Llegó por la campaña: ${esc(DB.campanas.find(k => k.id === v.campana).nombre)}</small>` : ''}</div>`;
}
function refrescaChat() {
  if (E.ruta !== 'bandeja') return;
  const m = $('#msgs'); if (m) { m.innerHTML = CONV().msgs.map(burbuja).join(''); m.scrollTop = m.scrollHeight; }
  const l = $('#listaConvs'); if (l) l.innerHTML = filasConv();
}
function enviarMsg(datos) {
  const v = CONV();
  const m = { de: 'a', por: E.usuario, h: ahora(), est: 'enviado', ...datos };
  v.msgs.push(m); v.hora = m.h; v.espera = ''; v.noLeidos = 0;
  refrescaChat();
  setTimeout(() => { m.est = 'entregado'; refrescaChat(); }, 900);
  setTimeout(() => { m.est = 'leido'; refrescaChat(); }, 2400);
}

/* ---------- Embudo ---------- */
function tarjetasDe(b) {
  if (b.tipo === 'tickets') return DB.tickets.map(k => ({ id: String(k.id), e: k.etapa, m: 0, dias: k.dias, titulo: `#${k.id} · ${k.motivo}`, sub: `${C(k.contacto).nombre} · asignado a ${U(k.asignado).nombre}`, ticket: k.id }));
  const base = DB.posiciones.filter(p => p.b === b.id);
  return base.map(p => { const c = C(p.c); return { id: c.id, e: p.e, m: p.m, dias: p.dias, titulo: c.nombre + (c.especial ? ' ★' : ''), sub: `${tipoDe(c)} · ${c.tel}`, contacto: c.id }; });
}
function vEmbudo() {
  const b = TB(E.embudo) || DB.embudos[0], esTickets = b.tipo === 'tickets';
  const rg = rangoRep(E.tb), fechaDe = t => hoy0() - t.dias * DIA;
  const ts = tarjetasDe(b).filter(t => !rg || (fechaDe(t) >= rg.a && fechaDe(t) <= rg.b));
  const etFecha = { general: 'Entrada al embudo', tickets: 'Creación del ticket', campana: 'Envío o entrada a la campaña' }[b.tipo];
  const cols = b.etapas.map(e => {
    const cs = ts.filter(t => t.e === e.id), suma = cs.reduce((s, t) => s + t.m, 0);
    return `<div class="columna" data-etapa="${e.id}"><header style="--c:${e.c}"><strong>${esc(e.n)}</strong><b>${cs.length}</b>${e.tipo !== 'abierta' ? `<small>${esTickets ? 'cierra el ticket' : { ganada: 'Ganada', perdida: 'Perdida' }[e.tipo]}</small>` : ''}${esTickets ? '' : `<span>$${suma.toLocaleString('es-MX')}</span>`}</header>
      <div class="tarjetas">${cs.map(t => `<div class="tarjeta" draggable="true" data-id="${t.id}"><strong>${esc(t.titulo)}</strong><small>${esc(t.sub)}</small><div class="t-pie"><span>${esTickets ? (t.dias ? `hace ${t.dias} d` : 'hoy') : t.m ? '$' + t.m.toLocaleString('es-MX') : '+ monto'}</span><a data-accion="${esTickets ? 'verTicket' : 'chatDe'}" data-id="${esTickets ? t.ticket : t.contacto}">${ico(esTickets ? 'ticket' : 'chat')}</a></div><select class="solo-movil" data-cambio="etapa" data-b="${b.id}" data-id="${t.id}">${b.etapas.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.n}</option>`).join('')}</select></div>`).join('')}</div></div>`;
  }).join('');
  const acc = `<label class="en-linea">Embudo<select class="sel-embudo" data-cambio="embudo">${DB.embudos.map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.n)} (${tarjetasDe(x).length})</option>`).join('')}</select></label>` + filtroFechas(E.tb, 'tb', true, etFecha) + (puede('A') && !E.movil ? btn('Gestionar etapas', 'gestionarEtapas') + btn('+ Nuevo embudo', 'nuevoEmbudo', 'primario') : '');
  const textoClaves = b.tipo === 'campana' ? ` Palabras clave de la campaña: ${(b.claves || []).length ? b.claves.join(', ') : 'ninguna'}.` : b.tipo === 'general' ? ` Atiende: ${b.numero ? 'solo el número ' + N(b.numero).nombre : 'todos los números'}. Palabras clave: ${(b.claves || []).length ? b.claves.join(', ') : 'ninguna'}.` : '';
  const textoTb = textoClaves + ' ' + (rg ? `${etFecha}: del ${fCorta(rg.a)} al ${fCorta(rg.b)}` : `${etFecha}: todas las fechas`) + ` · ${ts.length} ${ts.length === 1 ? 'tarjeta' : 'tarjetas'}`;
  return pagina(`Embudo · ${esc(b.n)}`, `${esc(b.desc || 'Arrastra una tarjeta para cambiar su etapa.')} ${textoTb}`, acc, `<div class="kanban">${cols}</div>`);
}
function embudoDeCampana(k) {
  const id = 'b' + Date.now();
  DB.embudos.push({ id, n: 'Campaña · ' + k.nombre, tipo: 'campana', campana: k.id, claves: (k.claves || '').split(',').map(y => y.trim()).filter(Boolean), desc: 'Se creó sola con la campaña, a partir del modelo de etapas.', etapas: [['Respondió', 'abierta', '#2563eb'], ['Interesado', 'abierta', '#7c3aed'], ['En seguimiento', 'abierta', '#f59e0b'], ['Compró', 'ganada', '#0e9f6e'], ['Sin interés', 'perdida', '#94a3b8']].map((e, i) => ({ id: id + 's' + i, n: e[0], tipo: e[1], c: e[2] })) });
}

/* ---------- Contactos ---------- */
function vContactos() {
  const q = E.buscaContacto.toLowerCase();
  const filas = DB.contactos.filter(c => !q || c.nombre.toLowerCase().includes(q) || c.tel.includes(q)).map(c => ({
    attr: `data-accion="fichaContacto" data-id="${c.id}" class="clic"`,
    c: [`<strong>${esc(c.nombre)}</strong>${c.especial ? ' ★' : ''}`, c.tel, chipTipo(c), c.tags.map(t => `<span class="tag" style="--c:${TAG(t).c}">${esc(TAG(t).n)}</span>`).join('') || '—', chipTab(c) || '<small class="nota">Sin embudo</small>', { otorgado: chip('Acepta campañas', 'verde'), baja: chip('Se dio de baja', 'rojo'), sin: chip('Sin permiso registrado', 'gris') }[c.consent], c.alta]
  }));
  const acc = `<input id="buscaContacto" class="buscador" placeholder="Buscar contacto" value="${esc(E.buscaContacto)}">` + (puede('AS') && !E.movil ? btn('Importar CSV', 'importar') + btn('Exportar CSV', 'exportar') : '') + btn('+ Nuevo contacto', 'nuevoContacto', 'primario');
  return pagina('Contactos', `${DB.contactos.length} contactos`, acc, tabla(['Nombre', 'Teléfono', 'Tipo', 'Tags', 'Embudo y etapa', 'Permiso para campañas', 'Alta'], filas));
}

/* ---------- Tickets ---------- */
function vTickets() {
  const rg = rangoRep(E.tk), creado = k => hoy0() - k.dias * DIA;
  const mios = DB.tickets.filter(k => (E.rol !== 'G' || k.asignado === E.usuario) && (!rg || (creado(k) >= rg.a && creado(k) <= rg.b)));
  const textoTk = (rg ? `Creados del ${fCorta(rg.a)} al ${fCorta(rg.b)}` : 'Creados en cualquier fecha') + ` · ${mios.length} ${mios.length === 1 ? 'ticket' : 'tickets'}`;
  const lista = mios.filter(k => k.estado === E.pestTickets);
  const pests = ['Abierto', 'En proceso', 'Cerrado'].map(p => `<button class="${E.pestTickets === p ? 'activo' : ''}" data-accion="pestTickets" data-p="${p}">${p === 'Abierto' ? 'Pendientes' : p} <b>${mios.filter(k => k.estado === p).length}</b></button>`).join('');
  return pagina('Tickets', `Tickets levantados desde una conversación. ${textoTk}`, filtroFechas(E.tk, 'tk', true), `<div class="pests suelta">${pests}</div><div class="rejilla">${lista.length ? lista.map(k => `<a class="carta clic" data-accion="verTicket" data-id="${k.id}"><div class="c-top"><strong>#${k.id} · ${esc(k.motivo)}</strong>${estadoChip(k.estado)}</div><p>${esc(k.desc)}</p><small>${esc(C(k.contacto).nombre)} · asignado a ${esc(U(k.asignado).nombre)} · levantado por ${esc(U(k.por).nombre)} · ${k.creado}</small></a>`).join('') : '<div class="vacio">No hay tickets en esta pestaña.</div>'}</div>`);
}
function verTicket(id) {
  const k = DB.tickets.find(x => x.id === +id);
  const cuerpo = `<div class="d-fila">${estadoChip(k.estado)}<span class="mini" style="--c:${ET(k.etapa).c}">Etapa: ${ET(k.etapa).n}</span><span>${esc(C(k.contacto).nombre)} · asignado a <strong>${esc(U(k.asignado).nombre)}</strong></span></div><p>${esc(k.desc)}</p>
    <h5>Comentarios internos</h5>${k.comentarios.map(c => `<div class="d-nota">${esc(c.t)}<small>${esc(U(c.por).nombre)} · ${c.f}</small></div>`).join('') || '<small class="nota">Aún sin comentarios. El primer comentario pasa el ticket a "En proceso" y registra el tiempo de primera respuesta.</small>'}
    ${k.estado !== 'Cerrado' ? `<label class="campo"><span>Nuevo comentario</span><textarea id="comTicket" rows="2"></textarea></label>` : ''}`;
  const pie = btn('Ir al chat', 'chatDe', '', `data-id="${k.contacto}"`) + (k.estado !== 'Cerrado' ? btn('Comentar', 'comentarTicket', '', `data-id="${k.id}"`) + btn('Cerrar ticket', 'cerrarTicket', 'primario', `data-id="${k.id}"`) : btn('Reabrir', 'reabrirTicket', '', `data-id="${k.id}"`));
  abrirModal(`Ticket #${k.id} · ${esc(k.motivo)}`, cuerpo, pie);
}

/* ---------- Campañas ---------- */
// Campañas de entrada: tienen fecha de inicio y de vencimiento, y su estado sale de esas fechas.
const estadoEntrada = k => { const t = Date.now(); return t < new Date(k.inicio) ? 'Programada' : t > new Date(k.fin) ? 'Finalizada' : 'Activa'; };
const rangoEntrada = k => fechaTxt(new Date(k.inicio)) + ' – ' + fechaTxt(new Date(k.fin));
function refrescaEntradas() { for (const k of DB.campanas) if (k.tipo === 'Entrada' && k.inicio) { k.estado = estadoEntrada(k); k.fecha = rangoEntrada(k); } }
const camposEntrada = (ini, fin) => [{ id: 'i', et: 'Fecha y hora de inicio', tipo: 'datetime-local', valor: ini }, { id: 'f', et: 'Fecha y hora de vencimiento', tipo: 'datetime-local', valor: fin }, { tipo: 'nota', et: 'Hora de Ciudad de México. Las palabras clave solo cuentan entre estas dos fechas: antes del inicio la campaña queda Programada y no hace nada; después del vencimiento queda Finalizada y deja de contar.' }];
const fechasEntrada = f => { const i = new Date(f.i), v = new Date(f.f); if (!f.i || isNaN(i)) { aviso('Falta la fecha de inicio'); return null; } if (!f.f || isNaN(v)) { aviso('Falta la fecha de vencimiento'); return null; } if (v <= i) { aviso('El vencimiento debe ser después del inicio'); return null; } return { inicio: f.i, fin: f.f }; };
function vCampanas() {
  refrescaEntradas();
  const filas = DB.campanas.map(k => ({ attr: `data-accion="verCampana" data-id="${k.id}" class="clic"`, c: [`<strong>${esc(k.nombre)}</strong>`, chip(k.tipo, k.tipo === 'Envío' ? 'azul' : 'gris'), k.plantilla || `Palabras clave: ${esc(k.claves)}`, estadoChip(k.estado) + (k.errores ? ` <small class="rojo">${k.errores} con error</small>` : ''), k.fecha, k.tipo === 'Envío' ? `<div class="progreso"><i style="width:${Math.round(k.enviados / k.total * 100)}%"></i></div><small>${k.enviados} / ${k.total}</small>` : `${k.total} conversaciones`, k.conversiones] }));
  return pagina('Campañas', 'Envíos masivos con plantilla aprobada y campañas de entrada por palabra clave', btn('+ Campaña de entrada', 'nuevaEntrada') + btn('+ Nueva campaña', 'nuevaCampana', 'primario'), tabla(['Campaña', 'Tipo', 'Plantilla', 'Estado', 'Fecha', 'Progreso', 'Conversiones'], filas));
}
// Programación de campañas: mínimo 10 minutos después de la fecha y hora actual, en la zona horaria de la empresa.
const MIN_PROG = 10;
const masPronto = () => { const d = new Date(Date.now() + MIN_PROG * 60000); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1); return d; };
const aLocal = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const fechaTxt = d => d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const campoFecha = (valor) => `<label class="campo"><span>Fecha y hora del envío</span><input type="datetime-local" name="cuando" id="cuandoCamp" min="${aLocal(masPronto())}" value="${valor || aLocal(new Date(Date.now() + 3600000))}"></label><p class="nota">Hora de Ciudad de México, la zona horaria de la empresa. Debe ser al menos ${MIN_PROG} minutos después de ahora: lo más pronto que puedes programar es ${fechaTxt(masPronto())}.</p>`;
const fechaValida = v => { const d = new Date(v); if (!v || isNaN(d)) { aviso('Elige la fecha y la hora del envío'); return null; } if (d.getTime() < Date.now() + MIN_PROG * 60000) { aviso(`Debe ser al menos ${MIN_PROG} minutos en el futuro: lo más pronto es ${fechaTxt(masPronto())}`); return null; } return d; };
function nuevaCampana() {
  const aprob = DB.plantillas.filter(p => p.estado === 'Aprobada');
  abrirModal('Nueva campaña', `<form id="formCamp" class="dos">
    <div><label class="campo"><span>Nombre</span><input name="nombre" value="Promoción de octubre"></label>
    <label class="campo"><span>Se envía desde el número</span><select name="numero">${DB.numeros.map(n => `<option value="${n.id}">${n.nombre} · ${n.tipo}</option>`).join('')}</select></label>
    <label class="campo"><span>Plantilla (solo aprobadas)</span><select name="plantilla" data-cambio="previaCamp">${aprob.map(p => `<option>${p.nombre}</option>`).join('')}</select></label>
    <label class="campo"><span>Destinatarios</span><select name="aud"><option>Cargar CSV (celular, variable_1 … variable_10)</option><option>Segmento por tags</option><option>Lista de difusión: Clientes activos</option></select></label>
    <label class="campo"><span>Envío</span><select name="envio" data-cambio="envioCamp"><option>Inmediato</option><option>Programar fecha y hora</option></select></label><div id="progCamp" class="oculto">${campoFecha()}</div>
    <label class="campo"><span>Palabras clave de la campaña, separadas por coma (opcional)</span><input name="claves" placeholder="promo, octubre"></label><p class="nota">Quien escriba una de estas palabras queda ligado a esta campaña y entra a la primera etapa de su embudo, aunque no haya recibido el envío. Los destinatarios que respondan entran de todos modos.</p></div>
    <div><span class="et">Vista previa</span><div class="previa" id="previaCamp">${previaPlantilla(aprob[0])}</div></div></form>`,
    btn('Cancelar', 'cerrarModal') + btn('Revisar antes de enviar', 'revisarCamp', 'primario'), 'ancho');
}
const previaPlantilla = p => `<div class="pl-prev"><div class="msg mio">${!p.tarjetas && p.encTipo && p.encTipo !== 'Ninguno' && p.encTipo !== 'Texto' ? `<div class="pl-medio">${esc(p.encTipo)}</div>` : ''}${p.encabezado ? `<strong class="pl-enc">${esc(p.encabezado)}</strong>` : ''}${p.oferta ? `<div class="pl-oferta"><b>${esc(p.oferta)}</b>${p.vence ? '<small>Vence en 2 días</small>' : ''}${p.codigo ? `<small>Código: ${esc(p.codigo)}</small>` : ''}</div>` : ''}<div>${esc(p.cuerpo)}</div>${p.pie ? `<small class="pl-pie">${esc(p.pie)}</small>` : ''}${(p.botones || []).map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}</div>${p.tarjetas ? `<div class="pl-cards">${p.tarjetas.map(t => `<div class="pl-card"><div class="pl-medio">${esc(p.encTipo || 'Foto')}</div><div>${esc(t.texto)}</div>${t.botones.map(b => `<div class="b-boton">${esc(b)}</div>`).join('')}</div>`).join('')}</div>` : ''}</div>`;
let campPendiente = null;
function revisarCamp() {
  const f = new FormData($('#formCamp'));
  const programada = f.get('envio').startsWith('Programar'), cuando = programada ? fechaValida(f.get('cuando')) : null;
  if (programada && !cuando) return;
  campPendiente = { nombre: f.get('nombre') || 'Campaña sin nombre', plantilla: f.get('plantilla'), numero: f.get('numero'), programada, cuando, claves: (f.get('claves') || '').split(',').map(y => y.trim()).filter(Boolean).join(', ') };
  abrirModal('Revisión antes de enviar', `<p>El sistema limpia la audiencia y respeta el límite diario de Meta.</p>
    <div class="resumen"><div><small>Cargados</small><strong>560</strong></div><div class="rojo"><small>Bajas excluidas</small><strong>14</strong></div><div class="ambar"><small>Duplicados</small><strong>21</strong></div><div class="ambar"><small>Números inválidos</small><strong>5</strong></div><div class="verde"><small>Se enviará a</small><strong>520</strong></div></div>
    <div class="d-fila"><span>Costo estimado (Marketing, 520 × US$0.0436)</span><strong>US$22.67</strong></div>
    <div class="d-fila"><span>Cupo disponible hoy</span><strong>1,480 de 2,000</strong></div>
    ${campPendiente.programada ? `<div class="d-fila"><span>Se enviará</span><strong>${fechaTxt(campPendiente.cuando)} · hora de Ciudad de México</strong></div>` : ''}
    <div class="d-fila"><span>Palabras clave</span><strong>${esc(campPendiente.claves) || 'ninguna'}</strong></div>
    <p class="nota">Alcanza en un solo día. Los botones de enlace se cambian por un enlace corto para saber quién hizo clic.</p>`,
    btn('Regresar', 'nuevaCampana') + btn(campPendiente.programada ? 'Programar campaña' : 'Enviar ahora', 'confirmarCamp', 'primario'));
}
function confirmarCamp() {
  const k = { id: 'k' + Date.now(), tipo: 'Envío', ...campPendiente, estado: campPendiente.programada ? 'Programada' : 'Enviando', fecha: campPendiente.programada ? fechaTxt(campPendiente.cuando) : 'hoy ' + ahora(), total: 520, enviados: 0, entregados: 0, leidos: 0, respuestas: 0, clics: 0, bajas: 0, conversiones: 0, errores: 0 };
  DB.campanas.unshift(k); embudoDeCampana(k); cerrarModal(); render();
  if (k.estado === 'Programada') return aviso('Campaña programada para ' + k.fecha);
  aviso('Envío iniciado: se envía por lotes');
  const t = setInterval(() => {
    k.enviados = Math.min(k.total, k.enviados + 65);
    if (k.enviados >= k.total) { k.estado = 'Enviada'; k.entregados = 498; k.errores = 6; clearInterval(t); aviso(`"${k.nombre}" terminó de enviarse`); }
    if (E.ruta === 'campanas' && $('#modal').className) render();
  }, 700);
}
function verCampana(id) {
  refrescaEntradas();
  const k = DB.campanas.find(x => x.id === id);
  const d = [['Enviados', k.enviados], ['Entregados', k.entregados], ['Leídos', k.leidos], ['Respuestas', k.respuestas], ['Clics', k.clics], ['Bajas', k.bajas], ['Conversiones', k.conversiones], ['Con error', k.errores]];
  abrirModal(esc(k.nombre), `<div class="d-fila">${estadoChip(k.estado)}<span>${k.tipo} · ${k.fecha} · ${N(k.numero).nombre}</span></div><div class="resumen">${d.map(x => `<div><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}</div><div class="d-fila"><span>Palabras clave</span><span>${k.claves ? esc(k.claves) : 'ninguna'}</span></div><p class="nota">La conversión cuenta cuando el contacto llega a una etapa ganada dentro de los 15 días siguientes a la campaña.</p>`, (k.tipo === 'Entrada' && k.inicio && k.estado !== 'Finalizada' ? btn('Editar fechas', 'fechasCamp', '', `data-id="${k.id}"`) : '') + (k.estado === 'Programada' && k.tipo !== 'Entrada' ? btn('Cancelar campaña', 'cancelarCamp', 'peligro', `data-id="${k.id}"`) + btn('Reprogramar', 'reprogramarCamp', '', `data-id="${k.id}"`) : '') + (DB.embudos.some(b => b.campana === k.id) ? btn('Ver embudo de la campaña', 'selEmbudo', '', `data-id="${DB.embudos.find(b => b.campana === k.id).id}"`) : '') + btn('Cerrar', 'cerrarModal'), 'ancho');
}

/* ---------- Pantallas de configuración ---------- */
const soloDig = t => String(t).replace(/\D/g, '');
const normTel = t => { let d = soloDig(t); if (d.length === 10) d = '52' + d; return d.length >= 11 && d.length <= 15 ? '+' + d : null; };
const esBaja = tel => DB.bajas.some(b => soloDig(b.tel) === soloDig(tel));
function vListas() {
  return pagina('Listas de difusión', 'Listas guardadas que se envían como campaña con plantilla aprobada. Haz clic en una lista para ver sus contactos.', btn('+ Nueva lista', 'nuevaLista', 'primario'), tabla(['Lista', 'Contactos', 'Se dieron de baja', 'Creada', ''], DB.listas.map(l => ({ attr: `data-accion="verLista" data-id="${l.id}" class="clic"`, c: [`<strong>${esc(l.nombre)}</strong>`, l.miembros.length, l.miembros.filter(m => esBaja(m.tel)).length, l.creada, btn('Usar en campaña', 'nuevaCampana', 'enlace')] }))));
}
// Lee el CSV de una lista: columnas nombre, apellido, telefono. No falla todo el archivo: cuenta lo que rechaza y por qué.
function leerCsvLista(texto, existentes) {
  const filas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/[,;\t]/).map(x => x.trim().replace(/^"|"$/g, '')));
  if (filas.length && /nombre/i.test(filas[0][0])) filas.shift();
  const r = { leidas: filas.length, ok: [], invalidos: 0, duplicados: 0, bajas: 0 }, vistos = new Set(existentes.map(m => soloDig(m.tel)));
  for (const [nombre, apellido, tel] of filas) {
    const t = normTel(tel || '');
    if (!nombre || !t) { r.invalidos++; continue; }
    if (vistos.has(soloDig(t))) { r.duplicados++; continue; }
    vistos.add(soloDig(t));
    if (esBaja(t)) { r.bajas++; continue; }
    r.ok.push({ nombre, apellido: apellido || '', tel: t, tipo: 'Importado' });
  }
  return r;
}
const camposCsv = () => `<label class="campo"><span>Archivo CSV con nombre, apellido y teléfono</span><input type="file" id="lstCsv" accept=".csv,text/csv"></label><div class="d-fila">${btn('Descargar plantilla de carga', 'plantillaCsv')}<small>Trae los encabezados exactos y una fila de ejemplo.</small></div>`;
function cargarCsv(lista, alTerminar) {
  const a = $('#lstCsv').files[0]; if (!a) return aviso('Falta elegir el archivo CSV');
  const lector = new FileReader();
  lector.onload = () => {
    const r = leerCsvLista(String(lector.result), lista.miembros);
    lista.miembros.push(...r.ok); alTerminar();
    abrirModal('Resultado de la carga', `<p>Lista <strong>${esc(lista.nombre)}</strong></p><div class="resumen"><div><small>Filas leídas</small><strong>${r.leidas}</strong></div><div class="verde"><small>Agregados</small><strong>${r.ok.length}</strong></div><div class="rojo"><small>Teléfono o nombre inválido</small><strong>${r.invalidos}</strong></div><div class="ambar"><small>Repetidos</small><strong>${r.duplicados}</strong></div><div class="rojo"><small>Se dieron de baja, excluidos</small><strong>${r.bajas}</strong></div></div><p class="nota">Los teléfonos de 10 dígitos se guardan con la lada de México (+52).</p>`, btn('Ver la lista', 'verLista', 'primario', `data-id="${lista.id}"`));
  };
  lector.readAsText(a);
}
function filasLista(l) {
  const q = (E.buscaLista || '').toLowerCase();
  const ms = l.miembros.filter(m => !q || (m.nombre + ' ' + m.apellido).toLowerCase().includes(q) || soloDig(m.tel).includes(soloDig(q) || '#'));
  return ms.length ? ms.map(m => `<tr><td><strong>${esc(m.nombre)} ${esc(m.apellido)}</strong></td><td>${esc(m.tel)}</td><td>${chip(m.tipo, 'azul')}</td><td>${esBaja(m.tel) ? chip('Se dio de baja', 'rojo') : chip('Recibe campañas', 'verde')}</td><td>${btn('Quitar', 'quitarDeLista', 'enlace rojo', `data-id="${l.id}" data-tel="${esc(m.tel)}"`)}</td></tr>`).join('') : '<tr><td colspan="5" class="vacio">Sin contactos</td></tr>';
}
function verLista(id) {
  const l = DB.listas.find(x => x.id === id), bajas = l.miembros.filter(m => esBaja(m.tel)).length;
  E.listaAbierta = id;
  abrirModal(esc(l.nombre), `<div class="resumen"><div><small>Contactos</small><strong>${l.miembros.length}</strong></div><div class="rojo"><small>Se dieron de baja</small><strong>${bajas}</strong></div><div class="verde"><small>Recibirían una campaña</small><strong>${l.miembros.length - bajas}</strong></div></div>
    <input id="buscaLista" placeholder="Buscar en la lista por nombre o teléfono" value="${esc(E.buscaLista || '')}">
    <div class="tabla-caja" style="margin-top:10px"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Tipo</th><th>Permiso para campañas</th><th></th></tr></thead><tbody id="filasLista">${filasLista(l)}</tbody></table></div>`,
    btn('Agregar más por CSV', 'masCsvLista', '', `data-id="${l.id}"`) + btn('Usar en campaña', 'nuevaCampana', 'primario'), 'ancho');
}
// Filtro general de fechas de Reportes: un solo rango manda sobre todo lo que se ve, y la comparación sigue al rango elegido.
const DIA = 86400000;
const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fCorta = d => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
function rangoRep(r = E.rep) {
  if (r.pre === 'todo') return null;
  const h = hoy0(); let a, b;
  if (r.pre === 'hoy') a = b = h;
  else if (r.pre === 'mes') { a = new Date(h.getFullYear(), h.getMonth(), 1); b = h; }
  else if (r.pre === 'per') { a = new Date(r.desde + 'T00:00'); b = new Date(r.hasta + 'T00:00'); }
  if (!a || isNaN(a) || isNaN(b) || a > b) { a = new Date(h - 6 * DIA); b = h; }
  const dias = Math.round((b - a) / DIA) + 1; let pa, pb;
  if (r.pre === 'mes') { pa = new Date(a.getFullYear(), a.getMonth() - 1, 1); pb = new Date(pa.getFullYear(), pa.getMonth(), Math.min(dias, new Date(a.getFullYear(), a.getMonth(), 0).getDate())); }
  else { pb = new Date(a - DIA); pa = new Date(pb - (dias - 1) * DIA); }
  return { a, b, pa, pb, dias };
}
function filtroFechas(r = E.rep, pref = 'rep', todo = false, etiqueta = 'Fechas') {
  const ops = [...(todo ? [['todo', 'Todas las fechas']] : []), ['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['mes', 'Este mes'], ['per', 'Rango personalizado']], tope = aLocal(hoy0()).slice(0, 10);
  return `<label class="en-linea">${etiqueta}<select data-cambio="${pref}Pre">${ops.map(o => `<option value="${o[0]}" ${r.pre === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>` + (r.pre === 'per' ? `<label class="en-linea">Del<input type="date" data-cambio="${pref}Desde" value="${r.desde}" max="${tope}"></label><label class="en-linea">al<input type="date" data-cambio="${pref}Hasta" value="${r.hasta}" max="${tope}"></label>` : '');
}
function vReportes() {
  const rg = rangoRep(), fac = rg.dias / 7, n = v => Math.max(1, Math.round(v * fac)).toLocaleString('es-MX');
  const textoRango = `Del ${fCorta(rg.a)} al ${fCorta(rg.b)} (${rg.dias} ${rg.dias === 1 ? 'día' : 'días'}), comparado con el periodo anterior: del ${fCorta(rg.pa)} al ${fCorta(rg.pb)}`;
  const R = DB.reporte, max = Math.max(...R.dias.map(d => d[1])), maxE = R.embudo[0][1];
  const kp = E.rol === 'G' ? [['Mis conversaciones', n(62)], ['Cerradas', n(51)], ['Primera respuesta', '6 min'], ['Resolución', '2 h 05 min']] : [['Mensajes recibidos', n(1254), '+8%'], ['Mensajes enviados (total)', n(1112), '+6%', 'todo lo que salió: agentes, automáticos y plantillas'], ['Plantillas enviadas', n(197), '+11%', `parte de los enviados (${Math.round(197 / 1112 * 100)}%) · son las que cobra Meta: US$${(2.0 * fac).toFixed(2)}`], ['% respondidas', '94%', '+2%'], ['Primera respuesta', '6 min', '−1 min'], ['Sin responder', n(14), '−3'], ['Contactos nuevos', n(96), '+12%'], ['Conversiones', n(53), '+9%']];
  return pagina('Reportes', textoRango, filtroFechas() + btn('Exportar CSV', 'exportar'), `
    <div class="indicadores suelta">${kp.map(k => `<div class="ind"><small>${k[0]}</small><strong>${k[1]}</strong>${k[2] ? `<em>${k[2]}</em>` : ''}${k[3] ? `<small class="ind-nota">${k[3]}</small>` : ''}</div>`).join('')}</div>
    <div class="rejilla dos">
      <div class="carta"><h3>Mensajes por día</h3><small>Datos de ejemplo: las cifras cambian con el rango para mostrar el comportamiento.</small><div class="leyenda"><i class="s1"></i>Recibidos<i class="s2"></i>Enviados</div><div class="barras">${R.dias.map(d => `<div class="dia"><div class="par"><i class="s1" style="height:${d[1] / max * 100}%" title="${d[1]} recibidos"></i><i class="s2" style="height:${d[2] / max * 100}%" title="${d[2]} enviados"></i></div><small>${d[0]}</small></div>`).join('')}</div></div>
      <div class="carta"><h3>Conversión · embudo Ventas</h3>${R.embudo.map(e => `<div class="emb"><span>${e[0]}</span><div><i style="width:${e[1] / maxE * 100}%"></i></div><b>${e[1]}</b></div>`).join('')}<p class="nota">Conversión a cliente: 17.4%</p></div>
    </div>
    ${E.rol === 'G' ? '' : `<h3 class="sub">Plantillas enviadas, por plantilla</h3>` + tabla(['Plantilla', 'Categoría', 'Enviadas', 'Entregadas', 'Leídas', 'Costo estimado'], [['confirmacion_pedido', 'Utilidad', 185, 181, 150, 1.48], ['catalogo_otono', 'Marketing', 12, 12, 9, 0.52]].map(f => ({ c: [`<strong>${f[0]}</strong>`, chip(f[1], 'azul'), n(f[2]), n(f[3]), n(f[4]), 'US$' + (f[5] * fac).toFixed(2)] })).concat([{ c: ['<strong>Total</strong>', '', `<strong>${n(197)}</strong>`, `<strong>${n(193)}</strong>`, `<strong>${n(159)}</strong>`, `<strong>US$${(2.0 * fac).toFixed(2)}</strong>`] }])) + `<p class="nota">Meta cobra por plantilla entregada. Los mensajes libres dentro de la ventana de 24 h no tienen costo.</p><h3 class="sub">Desempeño por agente</h3>` + tabla(['Agente', 'Asignadas', 'Cerradas', 'Primera respuesta', 'Resolución'], R.agentes.map(a => ({ c: [a[0], n(a[1]), n(a[2]), a[3], a[4]] }))) + `<h3 class="sub">Campañas</h3>` + tabla(['Campaña', 'Enviados', 'Entregados', 'Leídos', 'Respuestas', 'Clics', 'Bajas', 'Conversiones'], DB.campanas.map(k => ({ c: [esc(k.nombre), k.enviados, k.entregados, k.leidos, k.respuestas, k.clics, k.bajas, k.conversiones] })))}`);
}
// Configuración de un número: lo que la empresa decide se edita; lo que viene de Meta solo se muestra.
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const horarioTxt = n => (n.dias || []).length ? n.dias.map(d => DIAS[d - 1]).join(', ') + ' · ' + n.abre + ' a ' + n.cierra : 'Sin horario: siempre se considera abierto';
const cierreTxt = n => n.cierre ? 'Cierra sola tras ' + n.cierre + ' h sin mensajes' : 'No se cierra sola';
function editarNumero(id) {
  const n = N(id), dias = n.dias || [];
  abrirModal('Configuración de ' + esc(n.nombre), `<form id="formNum">
    <h5>Lo que tú decides</h5>
    <label class="campo"><span>Nombre visible en la bandeja</span><input name="nombre" value="${esc(n.nombre)}"></label>
    <div class="campo"><span>Usuarios que pueden atender este número</span>${DB.usuarios.map(u => `<label class="check"><input type="checkbox" name="u" value="${u.id}" ${u.numeros.includes(n.id) ? 'checked' : ''}>${esc(u.nombre)} <small>${u.rol}</small></label>`).join('')}</div>
    <label class="campo"><span>Cierre de conversaciones por inactividad</span><select name="cierre">${[[0, 'No cerrar solas'], [12, 'Después de 12 horas sin mensajes'], [24, 'Después de 24 horas sin mensajes'], [48, 'Después de 48 horas sin mensajes'], [72, 'Después de 72 horas sin mensajes']].map(o => `<option value="${o[0]}" ${(n.cierre || 0) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    <div class="campo"><span>Horario de atención</span><div class="paleta">${DIAS.map((d, i) => `<label><input type="checkbox" name="d" value="${i + 1}" ${dias.includes(i + 1) ? 'checked' : ''}><b>${d}</b></label>`).join('')}</div>
      <div class="dos-campos" style="margin-top:8px"><label class="campo"><span>Abre</span><input type="time" name="abre" value="${n.abre || '09:00'}"></label><label class="campo"><span>Cierra</span><input type="time" name="cierra" value="${n.cierra || '18:00'}"></label></div>
      <p class="nota">Fuera de este horario se envían los mensajes automáticos de "Fuera de horario". Sin días marcados, el número se considera siempre abierto.</p></div>
    <h5 style="margin-top:14px">Lo que viene de Meta (no se edita aquí)</h5>
    <div class="solo-lectura"><div><small>Número</small><strong>${n.tel}</strong></div><div><small>Tipo de conexión</small><strong>${n.tipo}</strong></div><div><small>Estado</small><strong>${n.estado}</strong></div><div><small>Calidad</small><strong>${n.calidad}</strong></div><div><small>Límite de envío</small><strong>${n.limite}</strong></div><div><small>Cuenta oficial</small><strong>${n.oficial ? 'Sí' : 'No'}</strong></div></div>
    <p class="nota">${n.tipo === 'QR' ? 'Este número usa el conector no oficial: no tiene calidad ni límite de Meta.' : 'Estos datos los asigna Meta y se actualizan solos. El número y el tipo de conexión no se cambian: para usar otro, se conecta un número nuevo.'}</p>
  </form>`, (n.estado === 'Conectado' ? btn('Desconectar número', 'desconectarNumero', 'peligro', `data-id="${n.id}"`) : '') + btn('Cancelar', 'cerrarModal') + btn('Guardar cambios', 'guardarNumero', 'primario', `data-id="${n.id}"`), 'ancho');
}
function vNumeros() {
  return pagina('Números', `${DB.numeros.length} de ${DB.empresa.numerosMax} números de tu plan`, btn('+ Conectar número', 'conectar', 'primario'), `<div class="rejilla">${DB.numeros.map(n => `<div class="carta"><div class="c-top"><strong>${esc(n.nombre)}</strong>${estadoChip(n.estado)}</div><p class="grande">${n.tel}</p><div class="d-fila">${chip(n.tipo, n.tipo === 'QR' ? 'rojo' : 'azul')}${n.oficial ? chip('Cuenta oficial', 'verde') : ''}</div><small>Calidad: ${n.calidad} · Límite: ${n.limite}</small><small>Con acceso: ${DB.usuarios.filter(u => u.numeros.includes(n.id)).map(u => u.nombre).join(', ') || 'nadie aún'}</small><small>Horario: ${horarioTxt(n)}</small><small>${cierreTxt(n)}</small><div>${btn('Editar configuración', 'editarNumero', '', `data-id="${n.id}"`)}</div></div>`).join('')}</div>`);
}
function conectar(paso) {
  if (!paso) return abrirModal('Conectar número', `<div class="opciones">
    <a data-accion="conectarPaso" data-p="Cloud API"><strong>Cloud API oficial</strong><small>Número nuevo para la plataforma. Sin riesgo de bloqueo por el conector.</small></a>
    <a data-accion="conectarPaso" data-p="Coexistencia"><strong>Coexistencia</strong><small>Sigues usando tu app WhatsApp Business en el celular y el CRM ve los mismos chats.</small></a>
    <a class="riesgo" data-accion="conectarPaso" data-p="QR"><strong>Conector QR (no oficial)</strong><small>Opción avanzada. Riesgo de bloqueo permanente del número.</small></a></div>`);
  if (paso === 'QR') return abrirModal('Conector QR · aviso de riesgo', `<p class="alerta">Este conector no es oficial y va contra los términos de WhatsApp. El número puede ser bloqueado de forma permanente y sin apelación.</p><label class="check"><input type="checkbox" id="aceptoQR">Entiendo el riesgo y lo acepto para este número</label><div class="qr"></div><p class="nota">Escanea el código desde WhatsApp en tu celular (simulado).</p>`, btn('Cancelar', 'cerrarModal') + btn('Ya lo escaneé', 'conectarFin', 'primario', 'data-p="QR"'));
  abrirModal('Conectar con Meta', `<div class="meta"><strong>Ventana de Meta (simulada)</strong><p>Inicia sesión con Facebook, elige tu portafolio comercial, tu cuenta de WhatsApp y el número.</p></div><label class="campo"><span>Nombre visible en el CRM</span><input id="nomNum" value="Ventas"></label>`, btn('Cancelar', 'cerrarModal') + btn('Continuar', 'conectarFin', 'primario', `data-p="${paso}"`));
}
// Tipos de plantilla de Meta. Los bloqueados existen en Meta pero dependen de algo que no entra en la primera versión.
const SIN_CATALOGO = 'requiere catálogo de productos (fase posterior)';
const TIPOS_PL = [
  { id: 'estandar', n: 'Mensaje estándar', cats: ['Marketing', 'Utilidad'], d: 'Encabezado opcional (texto, foto, video, documento o ubicación), cuerpo de hasta 1,024 caracteres, pie y hasta 10 botones.' },
  { id: 'carrusel', n: 'Carrusel', cats: ['Marketing'], d: 'Texto principal y de 2 a 10 tarjetas con foto o video, texto de hasta 160 caracteres y hasta 2 botones. Todas las tarjetas llevan la misma estructura.' },
  { id: 'oferta', n: 'Oferta por tiempo limitado', cats: ['Marketing'], d: 'Foto o video, etiqueta de oferta de 16 caracteres, cuerpo de hasta 600, código para copiar y botón de enlace. No admite pie ni se ve en WhatsApp de escritorio.' },
  { id: 'cupon', n: 'Código de cupón', cats: ['Marketing'], d: 'Texto con un botón que copia el cupón, de hasta 20 caracteres. No funciona en WhatsApp Web.' },
  { id: 'auth', n: 'Autenticación (código de verificación)', cats: ['Autenticación'], d: 'El texto lo pone Meta. No admite archivos, enlaces ni emojis.' },
  { id: 'catalogo', n: 'Catálogo', bloqueado: SIN_CATALOGO },
  { id: 'mpm', n: 'Varios productos', bloqueado: SIN_CATALOGO },
  { id: 'spm', n: 'Un producto', bloqueado: SIN_CATALOGO },
  { id: 'carruselProd', n: 'Carrusel de productos', bloqueado: SIN_CATALOGO },
  { id: 'llamada', n: 'Permiso para llamar', bloqueado: 'requiere llamadas de WhatsApp (fase posterior)' },
  { id: 'flow', n: 'Con formulario (Flows)', bloqueado: 'fuera del alcance por ahora' }
];
const cmp = (et, nombre, valor = '', extra = '') => `<label class="campo"><span>${et}</span><input name="${nombre}" value="${esc(valor)}" ${extra}></label>`;
const cmpSel = (et, nombre, ops) => `<label class="campo"><span>${et}</span><select name="${nombre}">${ops.map(o => `<option>${o}</option>`).join('')}</select></label>`;
const cmpArea = (et, nombre, valor, max) => `<label class="campo"><span>${et}</span><textarea name="${nombre}" rows="3" maxlength="${max}">${esc(valor)}</textarea></label>`;
function camposPl(t) {
  const baja = ' Responde BAJA para no recibir más mensajes.';
  if (t === 'estandar') return cmpSel('Encabezado', 'encTipo', ['Ninguno', 'Texto', 'Foto', 'Video', 'Documento', 'Ubicación']) + siHtml(cmp('Texto del encabezado (60)', 'encTexto', '', 'maxlength="60"'), 'encTipo', 'Texto') + cmpArea('Cuerpo (1,024). Variables: {{1}}, {{2}}…', 'cuerpo', 'Hola {{1}}, tenemos novedades para ti.', 1024) + cmp('Ejemplo de {{1}} (lo exige Meta)', 'ej', 'María') + cmp('Pie (60)', 'pie', '', 'maxlength="60"') + cmpArea('Botones de respuesta rápida, uno por línea (25 c/u)', 'rapidas', 'Me interesa', 300) + `<div class="dos-campos">${cmp('Botón de enlace', 'urlTxt', '', 'maxlength="25" placeholder="Ver más"')}${cmp('Botón de teléfono', 'telTxt', '', 'maxlength="25" placeholder="Llamar"')}</div>`;
  if (t === 'carrusel') return cmpArea('Texto principal (1,024)', 'cuerpo', 'Hola {{1}}, mira lo nuevo de este mes.' + baja, 1024) + `<div class="dos-campos">${cmpSel('Tarjetas', 'nTarjetas', [3, 2, 4, 5, 6, 7, 8, 9, 10])}${cmpSel('Cada tarjeta lleva', 'medio', ['Foto', 'Video'])}</div>` + cmp('Texto de cada tarjeta (160)', 'tTexto', 'Producto', 'maxlength="160"') + `<div class="dos-campos">${cmp('Botón 1 de la tarjeta', 'tB1', 'Ver producto', 'maxlength="25"')}${cmp('Botón 2 (opcional)', 'tB2', '', 'maxlength="25"')}</div>`;
  if (t === 'oferta') return cmpSel('Encabezado (obligatorio)', 'medio', ['Foto', 'Video']) + `<div class="dos-campos">${cmp('Etiqueta de la oferta (16)', 'oferta', '20% de descuento'.slice(0, 16), 'maxlength="16"')}${cmp('Código para copiar (15)', 'codigo', 'OTONO20', 'maxlength="15"')}</div>` + '<label class="check"><input type="checkbox" name="vence" checked>Mostrar cuándo vence (la fecha se indica al enviar)</label>' + cmpArea('Cuerpo (600)', 'cuerpo', 'Solo esta semana en toda la tienda.' + baja, 600) + cmp('Botón de enlace', 'urlTxt', 'Comprar', 'maxlength="25"');
  if (t === 'cupon') return cmp('Encabezado de texto (60)', 'encTexto', 'Tu cupón de bienvenida', 'maxlength="60"') + cmpArea('Cuerpo (1,024)', 'cuerpo', 'Hola {{1}}, usa este cupón en tu próxima compra.', 1024) + cmp('Código del cupón (20)', 'codigo', 'BIENVENIDA10', 'maxlength="20"') + cmp('Botón de respuesta rápida', 'rapida', 'Quiero comprar', 'maxlength="25"');
  if (t === 'auth') return cmpSel('Cómo recibe el código', 'otp', ['Copiar código', 'Autocompletar con un toque (solo Android)', 'Sin toque (solo Android)']) + '<label class="check"><input type="checkbox" name="seg" checked>Agregar "Por tu seguridad, no lo compartas"</label>' + cmp('El código vence en (1 a 90 minutos)', 'min', '10', 'type="number" min="1" max="90"') + siHtml(`<div class="dos-campos">${cmp('Paquete de la app Android', 'paquete', '', 'placeholder="com.empresa.app"')}${cmp('Firma de la app', 'firma', '', 'placeholder="11 caracteres"')}</div><p class="nota">Datos de la app Android del cliente, necesarios para esta forma de entrega.</p>`, 'otp', 'Autocompletar|Sin toque');
  return '';
}
function datosPl() {
  const f = Object.fromEntries(new FormData($('#formPl'))), t = f.tipo, lineas = s => (s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const p = { tipo: t, nombre: (f.nombre || 'plantilla_nueva').toLowerCase().replace(/[^a-z0-9_]+/g, '_'), cat: f.cat, idioma: 'Español (MX)', formato: TIPOS_PL.find(x => x.id === t).n, cuerpo: f.cuerpo || '', botones: [], envios: 0, clics: 0 };
  if (t === 'estandar') { p.encTipo = f.encTipo; p.encabezado = f.encTipo === 'Texto' ? f.encTexto : ''; p.pie = f.pie; p.botones = lineas(f.rapidas); if (f.urlTxt) p.botones.push('↗ ' + f.urlTxt); if (f.telTxt) p.botones.push('✆ ' + f.telTxt); if (f.cat === 'Marketing') p.botones.push('Darme de baja'); }
  if (t === 'carrusel') { p.encTipo = f.medio; p.tarjetas = Array.from({ length: +f.nTarjetas }, (_, i) => ({ texto: (f.tTexto || 'Tarjeta') + ' ' + (i + 1), botones: [f.tB1, f.tB2].filter(Boolean) })); }
  if (t === 'oferta') { p.encTipo = f.medio; p.oferta = f.oferta; p.vence = !!f.vence; p.codigo = f.codigo; p.botones = [f.codigo ? '⧉ Copiar código' : '', f.urlTxt ? '↗ ' + f.urlTxt : ''].filter(Boolean); }
  if (t === 'cupon') { p.encabezado = f.encTexto; p.codigo = f.codigo; p.botones = [f.rapida, f.codigo ? '⧉ Copiar código' : '', 'Darme de baja'].filter(Boolean); }
  if (t === 'auth') { p.cuerpo = '{{1}} es tu código de verificación.' + (f.seg ? ' Por tu seguridad, no lo compartas.' : ''); p.pie = f.min ? `Este código vence en ${f.min} minutos.` : ''; p.botones = f.otp === 'Copiar código' ? ['⧉ Copiar código'] : (f.otp || '').startsWith('Auto') ? ['Autocompletar'] : []; p.otp = f.otp; p.min = +f.min; p.paquete = f.paquete; }
  return p;
}
const pintaPreviaPl = () => { const d = $('#previaPl'); if (d) d.innerHTML = previaPlantilla(datosPl()); };

function modalPlantilla(tipo = 'estandar', nombre = '') {
  const T = TIPOS_PL.find(x => x.id === tipo);
  abrirModal('Crear plantilla', `<form id="formPl" class="dos"><div>
      <span class="et">1. Elige el tipo de plantilla</span><input type="hidden" name="tipo" value="${tipo}">
      <div class="tipos-pl">${TIPOS_PL.filter(x => !x.bloqueado).map(x => `<button type="button" class="${x.id === tipo ? 'activo' : ''}" data-accion="tipoPl" data-t="${x.id}">${x.n.split(' (')[0]}</button>`).join('')}</div>
      <p class="nota">${T.d}</p>
      <details class="nota"><summary>Otros tipos de Meta que aún no se pueden crear aquí (${TIPOS_PL.filter(x => x.bloqueado).length})</summary>${TIPOS_PL.filter(x => x.bloqueado).map(x => `<div>${x.n}: ${x.bloqueado}</div>`).join('')}</details>
      <span class="et">2. Llena sus datos</span>
      <div class="dos-campos">${cmp('Nombre (minúsculas, sin espacios)', 'nombre', nombre, 'placeholder="promo_octubre"')}${cmpSel('Categoría', 'cat', T.cats)}</div>
      ${camposPl(tipo)}
    </div><div><span class="et">Vista previa</span><div class="previa" id="previaPl"></div><p class="nota">Meta revisa la plantilla antes de que se pueda usar; puede tardar hasta 24 horas. Pide un ejemplo de cada variable y el archivo de muestra.</p></div></form>`,
    btn('Cancelar', 'cerrarModal') + btn('Enviar a aprobación', 'guardarPl', 'primario'), 'ancho');
  pintaPreviaPl();
  aplicarSi();
}
function guardarPl() {
  const p = datosPl();
  if (p.tipo !== 'auth' && !p.cuerpo.trim()) return aviso('El cuerpo es obligatorio');
  if (p.tipo === 'oferta' && !p.oferta) return aviso('Falta la etiqueta de la oferta');
  if (p.tipo === 'cupon' && !p.codigo) return aviso('Falta el código del cupón');
  if (p.tipo === 'auth' && !(p.min >= 1 && p.min <= 90)) return aviso('La vigencia del código va de 1 a 90 minutos');
  if (p.tipo === 'auth' && p.otp !== 'Copiar código' && !p.paquete) return aviso('Para autocompletar o sin toque falta el paquete de la app Android');
  if (p.botones.length > 10) return aviso('Meta permite máximo 10 botones');
  DB.plantillas.unshift({ ...p, id: 'p' + Date.now(), estado: 'En revisión' }); cerrarModal(); render(); aviso('Enviada a aprobación de Meta');
}
// Envío de una plantilla desde el chat: se piden todos sus parámetros antes de poder enviarla.
const varsDe = t => [...new Set([...(t || '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
const etVar = (vars, k) => (vars || {})[k] || (isNaN(k) ? k : 'Variable ' + k);
const llenar = (t, pref, vals) => (t || '').replace(/\{\{(\w+)\}\}/g, (m, k) => vals[pref + k] || m);
let plEnvio = null;
function modalEnviarPl(id) {
  const p = DB.plantillas.find(x => x.id === id), v = CONV(), c = v.contacto ? C(v.contacto) : null; plEnvio = p;
  const pre = et => /nombre/i.test(et) && c ? c.nombre.split(' ')[0] : '';
  const inp = (et, nombre, valor = '', extra = '') => `<label class="campo"><span>${esc(et)} *</span><input name="${nombre}" value="${esc(valor)}" required ${extra}></label>`;
  const arch = (et, nombre) => `<label class="campo"><span>${esc(et)} *</span><select name="${nombre}"><option>Usar el archivo guardado con la plantilla</option><option>Subir otro archivo (simulado)</option></select></label>`;
  let f = '';
  if (!p.tarjetas && ['Foto', 'Video', 'Documento'].includes(p.encTipo)) f += arch(p.encTipo + ' del encabezado', 'hMedio');
  if (p.encTipo === 'Ubicación') f += inp('Nombre del lugar', 'lugar') + inp('Dirección', 'direccion');
  for (const k of varsDe(p.encabezado)) f += inp('Encabezado: ' + etVar(p.vars, k), 'h_' + k, pre(etVar(p.vars, k)));
  for (const k of varsDe(p.cuerpo)) f += inp(etVar(p.vars, k), 'b_' + k, pre(etVar(p.vars, k)));
  if (p.oferta && p.vence) f += inp('La oferta vence el', 'vence', aLocal(new Date(Date.now() + 2 * DIA)), `type="datetime-local" min="${aLocal(new Date())}"`);
  if (p.codigo) f += inp('Código que se copia', 'codigo', p.codigo, 'maxlength="20"');
  if (p.urlVar) f += inp('Botón de enlace: ' + p.urlVar, 'u');
  (p.tarjetas || []).forEach((t, i) => { f += `<div class="f-grupo"><h4>Tarjeta ${i + 1}</h4>${arch(p.encTipo || 'Foto', 'c' + i + '_medio')}${varsDe(t.texto).map(k => inp(etVar(t.vars, k), 'c' + i + '_' + k)).join('')}</div>`; });
  abrirModal('Enviar plantilla · ' + esc(p.nombre), `<form id="formEnv" class="dos"><div><p class="nota">Llena los datos de esta plantilla. Meta rechaza una plantilla a la que le falta un dato, así que el botón de enviar se activa cuando están todos.</p>${f || '<p>Esta plantilla no tiene datos por llenar.</p>'}</div><div><span class="et">Así lo recibirá ${c ? esc(c.nombre.split(' ')[0]) : 'el grupo'}</span><div class="previa" id="previaEnv"></div><p class="nota" id="faltanEnv"></p></div></form>`,
    btn('Elegir otra plantilla', 'plantilla') + btn('Enviar plantilla', 'enviarPl', 'primario', 'id="btnEnv"'), 'ancho');
  pintaEnv();
}
function datosEnv() {
  const p0 = plEnvio, form = $('#formEnv'), vals = Object.fromEntries(new FormData(form));
  const faltan = [...form.querySelectorAll('[required]')].filter(i => !i.value.trim()).map(i => i.closest('label').querySelector('span').textContent.replace(' *', ''));
  const p = { ...p0, encabezado: llenar(p0.encabezado, 'h_', vals), cuerpo: llenar(p0.cuerpo, 'b_', vals), codigo: vals.codigo || p0.codigo, tarjetas: p0.tarjetas ? p0.tarjetas.map((t, i) => ({ ...t, texto: llenar(t.texto, 'c' + i + '_', vals) })) : undefined };
  if (p0.encTipo === 'Ubicación' && vals.lugar) p.encabezado = vals.lugar + (vals.direccion ? ' · ' + vals.direccion : '');
  return { p, valores: vals, faltan, completo: !faltan.length, medio: ['Foto', 'Video', 'Documento', 'Ubicación'].includes(p0.encTipo) ? p0.encTipo : '', vence: vals.vence ? fechaTxt(new Date(vals.vence)) : '' };
}
function pintaEnv() {
  const r = datosEnv(); $('#previaEnv').innerHTML = previaPlantilla(r.p);
  $('#btnEnv').disabled = !r.completo; $('#faltanEnv').textContent = r.completo ? 'Todo listo para enviar.' : 'Falta: ' + r.faltan.join(', ') + '.';
}
function vPlantillas() {
  return pagina('Plantillas de Meta', 'Solo las aprobadas se pueden usar en el chat y en campañas', btn('+ Crear plantilla', 'nuevaPlantilla', 'primario'), `<div class="rejilla">${DB.plantillas.map(p => `<div class="carta"><div class="c-top"><strong>${p.nombre}</strong>${estadoChip(p.estado)}</div><div class="d-fila">${chip(p.cat, 'azul')}${chip(p.formato, 'gris')}</div><div class="previa">${previaPlantilla(p)}</div>${p.motivo ? `<small class="rojo">${esc(p.motivo)}</small>` : `<small>${p.envios} envíos · ${p.clics} clics</small>`}</div>`).join('')}</div>`);
}
function vRespuestas() { return pagina('Respuestas rápidas', 'Mensajes guardados para usar desde el chat', btn('+ Nueva respuesta', 'nuevaRespuesta', 'primario'), `<div class="rejilla">${DB.respuestas.map(r => `<div class="carta"><strong>${esc(r.titulo)}</strong><p>${esc(r.texto)}</p>${r.archivo ? `<small>${ico('plant')} ${esc(r.archivo)}</small>` : ''}</div>`).join('')}</div>`); }
// Mensajes automáticos. Mismos términos que embudos y campañas: "conversaciones de", "palabras clave", "fecha de inicio" y "fecha de vencimiento".
const numeroTxt = id => id ? 'Solo el número ' + N(id).nombre : 'Todos los números';
const opsNumero = () => ['Todos los números', ...DB.numeros.map(n => 'Solo el número ' + n.nombre)];
const numeroDeOp = op => (DB.numeros.find(n => 'Solo el número ' + n.nombre === op) || {}).id || null;
const fechasAuto = a => a.inicio && a.fin ? fechaTxt(new Date(a.inicio)) + ' – ' + fechaTxt(new Date(a.fin)) : 'Siempre';
// El estado sale del interruptor y de las fechas: Apagado, Programado, Activo o Finalizado.
const estadoAuto = a => { if (!a.activo) return 'Apagado'; if (!(a.inicio && a.fin)) return 'Activo'; const t = Date.now(); return t < new Date(a.inicio) ? 'Programado' : t > new Date(a.fin) ? 'Finalizado' : 'Activo'; };
function formAuto(a) {
  const n = a || { nombre: '', numero: null, cuando: 'Por defecto', claves: '', coincidencia: 'Palabra completa', mensaje: '', inicio: '', fin: '' };
  const opCuando = { 'Por defecto': 'Por defecto (primer mensaje del cliente)', 'Fuera de horario': 'Fuera de horario', 'Palabras clave': 'Palabras clave' };
  formModal(a ? 'Editar mensaje automático' : 'Nuevo mensaje automático', [
    { id: 'n', et: 'Nombre', valor: n.nombre },
    { id: 'nu', et: 'Este mensaje responde en las conversaciones de', tipo: 'select', ops: opsNumero(), valor: numeroTxt(n.numero) },
    { id: 't', et: 'Cuándo se envía', tipo: 'select', ops: Object.values(opCuando), valor: opCuando[n.cuando] },
    { id: 'p', si: ['t', 'Palabras clave'], et: 'Palabras clave, separadas por coma', ph: 'precio, costo', valor: n.claves },
    { id: 'co', si: ['t', 'Palabras clave'], et: 'Cómo se comparan las palabras clave', tipo: 'select', ops: ['Palabra completa (recomendado)', 'Expresión regular (avanzado)'], valor: n.coincidencia === 'Expresión regular' ? 'Expresión regular (avanzado)' : 'Palabra completa (recomendado)' },
    { tipo: 'nota', si: ['t', 'Palabras clave'], et: 'Con palabra completa no importan mayúsculas ni acentos, igual que en embudos y campañas. La expresión regular es para casos especiales, por ejemplo un número de pedido.' },
    { id: 'm', et: 'Mensaje', tipo: 'area', valor: n.mensaje },
    { id: 'v', et: 'Cuándo está en uso', tipo: 'select', ops: ['Siempre', 'Entre dos fechas'], valor: n.inicio && n.fin ? 'Entre dos fechas' : 'Siempre' },
    { id: 'i', si: ['v', 'Entre dos fechas'], et: 'Fecha inicial', tipo: 'datetime-local', valor: n.inicio },
    { id: 'f', si: ['v', 'Entre dos fechas'], et: 'Fecha final', tipo: 'datetime-local', valor: n.fin },
    { tipo: 'nota', si: ['v', 'Entre dos fechas'], et: 'Antes de la fecha inicial el mensaje queda Programado y no se envía; después de la fecha final queda Finalizado.' }
  ], f => {
    const cuando = f.t.startsWith('Por defecto') ? 'Por defecto' : f.t, conFechas = f.v === 'Entre dos fechas';
    if (!f.m.trim()) return aviso('Falta el mensaje');
    if (cuando === 'Palabras clave' && !f.p.trim()) return aviso('Faltan las palabras clave');
    if (conFechas && (!f.i || !f.f)) return aviso('Faltan la fecha inicial y la fecha final');
    if (conFechas && new Date(f.f) <= new Date(f.i)) return aviso('La fecha final debe ser después de la inicial');
    const datos = { nombre: f.n || 'Mensaje automático', numero: numeroDeOp(f.nu), cuando, claves: cuando === 'Palabras clave' ? f.p : '', coincidencia: cuando === 'Palabras clave' ? f.co.split(' (')[0] : '', mensaje: f.m, inicio: conFechas ? f.i : '', fin: conFechas ? f.f : '' };
    if (a) Object.assign(a, datos); else DB.automaticos.push({ id: 'a' + Date.now(), ...datos, activo: true });
    render(); aviso(a ? 'Cambios guardados' : 'Mensaje automático guardado');
  }, a ? 'Guardar cambios' : 'Guardar');
}
function vAutomaticos() {
  return pagina('Mensajes automáticos', 'Se envían solos cuando se cumple su condición; a cada mensaje del cliente se le aplica uno solo', btn('+ Nuevo mensaje automático', 'nuevoAuto', 'primario'), tabla(['Nombre', 'Conversaciones de', 'Cuándo se envía', 'Palabras clave', 'Mensaje', 'En uso', 'Estado', 'Encendido', ''], DB.automaticos.map(a => ({ c: [`<strong>${esc(a.nombre)}</strong>`, numeroTxt(a.numero), chip(a.cuando, 'azul'), a.cuando === 'Palabras clave' ? esc(a.claves) + (a.coincidencia === 'Expresión regular' ? ' <small>(expresión regular)</small>' : '') : '<small class="nota">No aplica</small>', esc(a.mensaje), fechasAuto(a), estadoChip(estadoAuto(a)), `<label class="interruptor"><input type="checkbox" data-cambio="autoActivo" data-id="${a.id}" ${a.activo ? 'checked' : ''}><i></i></label>`, btn('Editar', 'editarAuto', 'enlace', `data-id="${a.id}"`)] }))));
}
// Tipos de contacto: catálogo que administra cada empresa. Ningún cálculo depende de ellos.
const tipoDe = c => c.tipo || 'Sin tipo';
const chipTipo = c => chip(tipoDe(c), c.tipo ? 'azul' : 'gris');
const usanTipo = t => DB.contactos.filter(c => c.tipo === t).length;
function cartaTipos() {
  return `<div class="carta"><h3>Tipos de contacto ${btn('+ Tipo', 'nuevoTipo', 'enlace')}</h3><p class="nota">Tu propia lista para clasificar contactos. Es la que aparece en "Nuevo contacto".</p>${DB.tiposContacto.map((t, i) => `<div class="d-fila etapa"><span>${chip(t, 'azul')} <small>${usanTipo(t)} ${usanTipo(t) === 1 ? 'contacto' : 'contactos'}</small></span><span>${btn('Renombrar', 'renombrarTipo', 'enlace', `data-i="${i}"`)}${btn('Eliminar', 'eliminarTipo', 'enlace rojo', `data-i="${i}"`)}</span></div>`).join('') || '<small class="nota">No hay tipos. Los contactos quedan "Sin tipo".</small>'}</div>`;
}
function vTags() {
  return pagina('Tags y embudos', 'Un tag es una etiqueta que el contacto carga; una etapa es el paso en el que va dentro de un embudo', btn('+ Grupo de tags', 'nuevoGrupo') + btn('+ Nuevo embudo', 'nuevoEmbudo', 'primario'), `<div class="rejilla dos">
    <div class="carta"><h3>Grupos de tags</h3>${DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)} ${btn('+ Tag', 'nuevoTag', 'enlace', `data-id="${g.id}"`)}</h4><div class="tags">${g.tags.map(t => `<span class="tag" style="--c:${t.c}">${esc(t.n)}</span>`).join('')}</div></div>`).join('')}</div>
    <div class="carta"><h3>Embudos y sus etapas</h3>${DB.embudos.map(b => `<div class="f-grupo"><h4>${esc(b.n)} ${chip({ general: 'General', tickets: 'Tickets', campana: 'Campaña' }[b.tipo], 'gris')} ${btn('Abrir', 'selEmbudo', 'enlace', `data-id="${b.id}"`)}</h4><div class="tags">${b.etapas.map(e => `<span class="mini" style="--c:${e.c}">${esc(e.n)}${e.tipo === 'ganada' ? ' ✓' : e.tipo === 'perdida' ? ' ✕' : ''}</span>`).join('')}</div>${b.tipo !== 'tickets' ? `<small class="nota">Palabras clave: ${(b.claves || []).length ? esc(b.claves.join(', ')) : 'ninguna'}</small>` : ''}</div>`).join('')}<p class="nota">✓ resultado Ganada · ✕ resultado Perdida · sin marca, En proceso. Los embudos de campaña se crean solos y se archivan al terminar la campaña.</p></div>${cartaTipos()}</div>`);
}
function vBajas() { return pagina('Bajas', 'Lista de supresión: ninguna campaña puede enviar a estos teléfonos', btn('Exportar CSV', 'exportar') + btn('+ Baja manual', 'nuevaBaja', 'primario'), tabla(['Teléfono', 'Contacto', 'Fecha', 'Origen', 'Campaña', ''], DB.bajas.map((b, i) => ({ c: [b.tel, esc(b.contacto), b.fecha, chip(b.origen, 'gris'), esc(b.campana), puede('A') ? btn('Quitar baja', 'quitarBaja', 'enlace rojo', `data-i="${i}"`) : ''] }))) + `<p class="nota">Palabras de baja: BAJA, STOP. Toda plantilla de marketing lleva botón de baja.</p>`); }
function vUsuarios() { return pagina('Usuarios', `${DB.usuarios.length} de ${DB.empresa.usuariosMax} usuarios de tu plan`, btn('+ Invitar usuario', 'nuevoUsuario', 'primario'), tabla(['Nombre', 'Correo', 'Rol', 'Sucursal', 'Números', 'Estado'], DB.usuarios.map(u => ({ c: [`<span class="avatar chico">${u.ini}</span> <strong>${esc(u.nombre)}</strong>`, esc(u.correo), chip(u.rol, 'azul'), u.sucursal, u.numeros.map(n => N(n).nombre).join(', '), `<i class="punto ${u.disp ? 'ok' : ''}"></i> ${u.disp ? 'Disponible' : 'No disponible'}`] })))); }
function vPlan() {
  const e = DB.empresa, uso = (a, b) => `<div class="progreso"><i style="width:${a / b * 100}%"></i></div><small>${a} de ${b}</small>`;
  return pagina('Mi plan', 'Paquete actual y uso', '', `<div class="rejilla dos"><div class="carta"><h3>${e.plan}</h3><p class="alerta suave">Te quedan ${e.diasPrueba} días de prueba. Al terminar, la cuenta queda en pausa hasta que se active un paquete.</p>${btn('Ver cómo se ve la cuenta en pausa', 'ir', '', 'data-ruta="pausa"')}</div><div class="carta"><h3>Uso</h3><span class="et">Usuarios</span>${uso(DB.usuarios.length, e.usuariosMax)}<span class="et">Números conectados</span>${uso(DB.numeros.length, e.numerosMax)}</div></div>`);
}
function vEmpresas() {
  const acc = (e, i) => e.estado === 'Activa' ? btn('Suspender', 'empAccion', 'enlace rojo', `data-i="${i}" data-e="Suspendida"`) : e.estado === 'En prueba' ? btn('Activar paquete', 'empAccion', 'enlace', `data-i="${i}" data-e="Activa"`) + btn('Extender prueba', 'empExtender', 'enlace', `data-i="${i}"`) : btn(e.estado === 'Suspendida' ? 'Reactivar' : 'Activar paquete', 'empAccion', 'enlace', `data-i="${i}" data-e="Activa"`);
  return pagina('Empresas', 'Empresas registradas en la plataforma', '', tabla(['Empresa', 'Estado', 'Paquete', 'Fin de prueba', 'Usuarios', 'Números', 'Alta', 'Acciones'], DB.empresas.map((e, i) => ({ c: [`<strong>${esc(e.nombre)}</strong>`, estadoChip(e.estado), e.plan, e.fin, e.usuarios, e.numeros, e.alta, acc(e, i)] }))));
}
function vPaquetes() { return pagina('Paquetes', 'Lo que incluye cada paquete', '', tabla(['Paquete', 'Conexión', 'Usuarios', 'Números', 'Campañas masivas', 'Precio'], DB.paquetes.map(p => ({ c: [`<strong>${p.nombre}</strong>`, p.conexion, p.usuarios, p.numeros, p.campanas, p.precio] })))); }
function vNumerosPlat() { return pagina('Números conectados', 'Estado ante Meta de los números de todas las empresas', '', tabla(['Empresa', 'Número', 'Tipo', 'Estado', 'Calidad'], [['Aromas del Norte', 'Pedidos', 'Cloud API', 'Conectado', 'Alta'], ['Aromas del Norte', 'Atención a clientes', 'Coexistencia', 'Conectado', 'Media'], ['Ferretería El Tornillo', 'Ventas', 'Cloud API', 'Conectado', 'Alta'], ['Autopartes Rivas', 'Mostrador', 'QR', 'Suspendida', '—']].map(f => ({ c: [f[0], f[1], chip(f[2], f[2] === 'QR' ? 'rojo' : 'azul'), estadoChip(f[3]), f[4]] })))); }
function vPerfil() {
  const u = U(E.usuario);
  return pagina('Perfil', 'Tu cuenta y disponibilidad', '', `<div class="carta estrecha centro"><span class="avatar grande">${u.ini}</span><h3>${esc(u.nombre)}</h3><small>${esc(u.correo)} · ${E.rol === 'P' ? 'Superadministrador' : u.rol} · ${u.sucursal}</small>
    <div class="d-fila"><span>Disponible para recibir conversaciones</span><label class="interruptor"><input type="checkbox" data-cambio="disp" ${u.disp ? 'checked' : ''}><i></i></label></div>
    <div class="d-fila"><span>Notificaciones</span><label class="interruptor"><input type="checkbox" checked><i></i></label></div>${btn('Cerrar sesión', 'ir', 'ancho', 'data-ruta="login"')}</div>`);
}
const vLogin = () => `<div class="acceso"><div class="a-caja"><span class="logo grande">E</span><h1>Enlaza CRM</h1><p>Atiende todos tus chats de WhatsApp desde un solo lugar</p>
  <label class="campo"><span>Correo</span><input value="adely@aromasdelnorte.test"></label><label class="campo"><span>Contraseña</span><input type="password" value="prototipo"></label>
  ${btn('Entrar', 'entrar', 'primario ancho')}<a data-accion="registro">Registrar mi empresa · 7 días gratis</a><a data-accion="aviso" data-t="Se enviaría un correo para recuperar la contraseña">Olvidé mi contraseña</a></div></div>`;
const vPausa = () => `<div class="acceso"><div class="a-caja"><span class="logo grande ambar">!</span><h1>Tu prueba terminó</h1><p>Tu cuenta está en pausa. Tus mensajes entrantes se siguen guardando, pero no puedes responder ni enviar campañas hasta activar un paquete.</p>${btn('Contactar para activar mi paquete', 'aviso', 'primario ancho', 'data-t="Se abriría el contacto de ventas"')}<a data-accion="entrar">Volver al prototipo</a></div></div>`;

const VISTAS = { bandeja: vBandeja, embudo: vEmbudo, contactos: vContactos, tickets: vTickets, campanas: vCampanas, listas: vListas, reportes: vReportes, numeros: vNumeros, plantillas: vPlantillas, respuestas: vRespuestas, automaticos: vAutomaticos, tags: vTags, bajas: vBajas, usuarios: vUsuarios, plan: vPlan, empresas: vEmpresas, paquetes: vPaquetes, numerosPlat: vNumerosPlat, perfil: vPerfil };

/* ---------- Pintado ---------- */
function render() {
  document.body.classList.toggle('movil', E.movil);
  const app = $('#app');
  if (E.ruta === 'login') return app.innerHTML = vLogin();
  if (E.ruta === 'pausa') return app.innerHTML = vPausa();
  let it = ITEMS.find(i => i.r === E.ruta);
  if (!permite(it)) { E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; it = ITEMS.find(i => i.r === E.ruta); }
  const cuerpo = E.movil && !it.movil ? `<div class="vacio alto">${ico('tel')}<h3>${it.n}</h3><p>Esta sección se usa desde una computadora.</p></div>` : VISTAS[E.ruta]();
  app.innerHTML = `<div class="shell">${menu()}<main class="contenido">${cuerpo}</main>${navMovil()}</div>`;
  const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
}

/* ---------- Acciones ---------- */
const A = {
  ir: d => { E.ruta = d.ruta; E.panel = 'lista'; cerrarModal(); render(); },
  entrar: () => { E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; render(); },
  aviso: d => aviso(d.t),
  registro: () => formModal('Registrar mi empresa', [{ id: 'e', et: 'Nombre comercial' }, { id: 'n', et: 'Tu nombre' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 't', et: 'Celular' }, { id: 'p', et: 'Contraseña', tipo: 'password' }, { tipo: 'nota', et: 'Tendrás 7 días de prueba gratis. Al terminar, la cuenta queda en pausa hasta activar un paquete.' }], () => { aviso('Empresa creada: te enviamos un correo de confirmación'); E.ruta = 'bandeja'; render(); }, 'Crear cuenta'),
  cerrarModal,
  colMenu: () => { E.menuCol = !E.menuCol; try { localStorage.setItem('crmMenuCol', E.menuCol ? '1' : ''); } catch (e) {} render(); },
  guardarForm: () => { const v = Object.fromEntries(new FormData($('#formGen'))); const cb = alGuardar; cerrarModal(); cb && cb(v); },
  abrirConv: d => { E.conv = d.id; CONV().noLeidos = 0; E.panel = 'chat'; render(); },
  panel: d => { E.panel = d.p; render(); },
  pest: d => { E.pest = d.p; render(); },
  toggleFiltros: () => { E.verFiltros = !E.verFiltros; render(); },
  limpiar: () => { E.f = { tags: [], embudo: '', etapa: '', resp: '', campana: '', misTickets: false, especial: false }; E.busca = ''; E.pest = 'todas'; render(); },
  enviar: () => { const t = $('#texto'); if (!t.value.trim()) return; enviarMsg({ t: t.value.trim() }); t.value = ''; t.focus(); },
  emoji: () => { const t = $('#texto'); t.value += '🙂'; t.focus(); },
  voz: () => { enviarMsg({ tipo: 'audio', t: 'Nota de voz · 0:08' }); aviso('Nota de voz enviada (simulada)'); },
  menuMas: () => abrirModal('Adjuntar', `<div class="opciones">${[['rapidas', 'Respuestas rápidas'], ['plantilla', 'Plantilla aprobada'], ['adjFoto', 'Foto'], ['adjVideo', 'Video'], ['adjDoc', 'Archivo']].map(o => `<a data-accion="${o[0]}"><strong>${o[1]}</strong></a>`).join('')}</div>`),
  adjFoto: () => { cerrarModal(); enviarMsg({ tipo: 'imagen', t: 'Foto · producto.jpg' }); },
  adjVideo: () => { cerrarModal(); enviarMsg({ tipo: 'imagen', t: 'Video · demostracion.mp4' }); },
  adjDoc: () => { cerrarModal(); enviarMsg({ tipo: 'doc', t: 'Lista-de-precios.pdf' }); },
  rapidas: () => abrirModal('Respuestas rápidas', `<div class="opciones">${DB.respuestas.map(r => `<a data-accion="usarRapida" data-id="${r.id}"><strong>${esc(r.titulo)}</strong><small>${esc(r.texto)}</small></a>`).join('')}</div>`),
  usarRapida: d => { const r = DB.respuestas.find(x => x.id === d.id); cerrarModal(); const t = $('#texto'); if (t) { t.value = r.texto; t.focus(); } },
  plantilla: () => abrirModal('Enviar plantilla', `<p class="nota">Solo aparecen las plantillas aprobadas por Meta. Con la ventana cerrada es la única forma de escribirle al cliente.</p><div class="opciones">${DB.plantillas.filter(p => p.estado === 'Aprobada').map(p => `<a data-accion="usarPlantilla" data-id="${p.id}"><strong>${p.nombre}</strong> ${chip(p.cat, 'azul')}<small>${esc(p.cuerpo)}</small></a>`).join('')}</div>`),
  usarPlantilla: d => modalEnviarPl(d.id),
  enviarPl: () => { const r = datosEnv(); if (!r.completo) return aviso('Faltan datos de la plantilla'); const p = r.p, v = CONV(); cerrarModal(); enviarMsg({ tipo: 'plantilla', t: p.cuerpo, botones: p.botones, enc: p.encabezado, medio: p.tarjetas ? '' : r.medio, oferta: p.oferta ? p.oferta + (r.vence ? ' · vence ' + r.vence : '') : '', nTarjetas: p.tarjetas ? p.tarjetas.length : 0, params: r.valores }); aviso(v.gratis > 0 ? 'Plantilla enviada sin costo: el chat entró por anuncio' : `Plantilla de ${p.cat} enviada: se suma al contador de costo`); },
  simular: () => formModal('Simular mensaje del cliente', [{ id: 't', et: 'Lo que escribe el cliente', tipo: 'area', valor: 'Hola, ¿me pasas el precio del catálogo?' }, { tipo: 'nota', et: 'Palabras clave de los embudos: ' + (DB.embudos.filter(b => (b.claves || []).length).map(b => esc(b.n) + ' (' + esc(b.claves.join(', ')) + ')').join('; ') || 'ninguna') + '. Si el mensaje contiene una, el contacto entra solo a ese embudo.' }], f => { const v = CONV(), texto = (f.t || '').trim() || 'Hola'; v.msgs.push({ de: 'c', autor: v.grupo ? 'Mariana Solís' : '', t: texto, h: ahora() }); if (v.estado !== 'abierta') { v.estado = 'abierta'; v.msgs.push({ de: 's', t: 'La conversación se reabrió porque el cliente escribió', h: ahora() }); } const entro = aplicarClaves(v, texto); v.ventana = 1440; v.espera = '1 min'; v.hora = ahora(); render(); aviso(entro.length ? 'Entró solo a: ' + entro.join(', ') : 'Llegó un mensaje: la ventana de 24 h se reinicia'); }, 'Recibir mensaje'),
  asignar: () => abrirModal('Asignar conversación', `<div class="opciones">${DB.usuarios.filter(u => u.numeros.includes(CONV().numero)).filter(u => puede('AS') || u.id === E.usuario).map(u => `<a data-accion="asignarA" data-id="${u.id}"><strong><span class="avatar chico">${u.ini}</span> ${esc(u.nombre)}${u.id === E.usuario ? ' (yo)' : ''}</strong><small><i class="punto ${u.disp ? 'ok' : ''}"></i>${u.disp ? 'Disponible' : 'No disponible'} · ${DB.conversaciones.filter(v => v.resp === u.id && v.estado === 'abierta').length} conversaciones abiertas</small></a>`).join('')}</div>${puede('AS') ? '' : '<p class="nota">Como agente solo puedes tomar la conversación para ti.</p>'}`),
  asignarA: d => { const v = CONV(); v.resp = d.id; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} asignó la conversación a ${U(d.id).nombre}`, h: ahora() }); cerrarModal(); render(); aviso(`Asignada a ${U(d.id).nombre}`); },
  finalizar: () => { const v = CONV(); if (ticketsAbiertosDe(v) && !confirm('Esta conversación tiene tickets abiertos. ¿Cerrarla de todos modos?')) return; v.estado = 'cerrada'; v.espera = ''; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} cerró la conversación`, h: ahora() }); E.pest = 'cerradas'; render(); aviso('Conversación cerrada'); },
  reabrir: () => { const v = CONV(); v.estado = 'abierta'; v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} reabrió la conversación`, h: ahora() }); E.pest = 'todas'; render(); },
  tagModal: () => abrirModal('Agregar tag', DB.gruposTags.map(g => `<div class="f-grupo"><h4>${esc(g.nombre)}</h4><div class="tags">${g.tags.map(t => `<a class="tag" style="--c:${t.c}" data-accion="ponerTag" data-id="${t.id}">${esc(t.n)}</a>`).join('')}</div></div>`).join('')),
  ponerTag: d => { const v = CONV(); if (!v.tags.includes(d.id)) v.tags.push(d.id); cerrarModal(); render(); },
  quitarTag: d => { const v = CONV(), c = C(v.contacto); v.tags = v.tags.filter(t => t !== d.id); c.tags = c.tags.filter(t => t !== d.id); render(); },
  notaModal: () => formModal('Nota interna', [{ id: 't', et: 'Nota (no se envía al cliente)', tipo: 'area' }], v => { if (v.t) C(CONV().contacto).notas.push({ t: v.t, por: E.usuario, f: 'hoy' }); render(); }),
  ticketModal: () => formModal('Levantar ticket', [{ id: 'm', et: 'Motivo', tipo: 'select', ops: DB.motivos }, { id: 'd', et: 'Descripción', tipo: 'area' }, { id: 'a', et: 'Asignar a', tipo: 'select', ops: DB.usuarios.map(u => u.nombre) }], f => { const v = CONV(), u = DB.usuarios.find(x => x.nombre === f.a); DB.tickets.unshift({ id: Math.max(...DB.tickets.map(k => k.id)) + 1, conv: v.id, contacto: v.contacto, motivo: f.m, estado: 'Abierto', etapa: 'q1', dias: 0, por: E.usuario, asignado: u.id, creado: 'hoy ' + ahora(), desc: f.d || 'Sin descripción', comentarios: [] }); v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} levantó un ticket: ${f.m}`, h: ahora() }); render(); aviso(`Ticket asignado a ${u.nombre}`); }, 'Levantar ticket'),
  baja: () => { const c = C(CONV().contacto); if (!confirm(`¿Dar de baja a ${c.nombre}? Ya no recibirá campañas. Podrás seguir atendiéndolo cuando escriba.`)) return; c.consent = 'baja'; DB.bajas.unshift({ tel: c.tel, contacto: c.nombre, fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), origen: 'Manual', campana: '—' }); render(); aviso('Agregado a la lista de supresión'); },
  verTicket: d => verTicket(d.id),
  comentarTicket: d => { const k = DB.tickets.find(x => x.id === +d.id), t = $('#comTicket').value.trim(); if (!t) return; k.comentarios.push({ por: E.usuario, t, f: 'hoy ' + ahora() }); if (k.estado === 'Abierto') { k.estado = 'En proceso'; k.etapa = 'q2'; } E.pestTickets = k.estado; render(); verTicket(k.id); },
  cerrarTicket: d => { const k = DB.tickets.find(x => x.id === +d.id); k.estado = 'Cerrado'; k.etapa = 'q4'; E.pestTickets = 'Cerrado'; cerrarModal(); render(); aviso(`Ticket #${k.id} cerrado`); },
  reabrirTicket: d => { const k = DB.tickets.find(x => x.id === +d.id); k.estado = 'En proceso'; k.etapa = 'q2'; E.pestTickets = 'En proceso'; cerrarModal(); render(); },
  pestTickets: d => { E.pestTickets = d.p; render(); },
  chatDe: d => { const v = DB.conversaciones.find(x => x.contacto === d.id); cerrarModal(); if (!v) return aviso('Este contacto aún no tiene conversación'); E.conv = v.id; E.ruta = 'bandeja'; E.panel = 'chat'; E.pest = v.estado === 'abierta' ? 'todas' : 'cerradas'; render(); },
  nuevaConv: () => formModal('Nueva conversación', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Celular', ph: '10 dígitos' }, { tipo: 'nota', et: 'Como no hay ventana abierta, el primer mensaje debe ser una plantilla aprobada.' }], f => { if (!f.n || !f.t) return aviso('Nombre y celular son obligatorios'); const c = { id: 'c' + Date.now(), nombre: f.n, tel: '+52 ' + f.t, tipo: DB.tiposContacto[0] || '', especial: false, correo: '', consent: 'sin', tags: [], alta: 'hoy', notas: [] }; DB.contactos.push(c); const v = { id: 'v' + Date.now(), numero: E.numero === 'todos' ? 'n1' : E.numero, contacto: c.id, resp: E.usuario, estado: 'abierta', noLeidos: 0, espera: '', ventana: 0, tags: [], campana: null, hora: ahora(), msgs: [{ de: 's', t: 'Conversación creada', h: ahora() }] }; DB.conversaciones.unshift(v); E.conv = v.id; E.panel = 'chat'; E.pest = 'todas'; render(); }, 'Crear'),
  nuevoContacto: () => formModal('Nuevo contacto', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Celular' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 'tp', et: 'Tipo de contacto', tipo: 'select', ops: [...DB.tiposContacto, 'Sin tipo'] }], f => { if (!f.n || !f.t) return aviso('Nombre y celular son obligatorios'); DB.contactos.push({ id: 'c' + Date.now(), nombre: f.n, tel: '+52 ' + f.t, tipo: f.tp === 'Sin tipo' ? '' : f.tp, especial: f.tp === 'Cliente especial', correo: f.c, consent: 'sin', tags: [], alta: 'hoy', notas: [] }); render(); aviso('Contacto creado'); }),
  fichaContacto: d => { const c = C(d.id); abrirModal(esc(c.nombre), `<div class="d-fila"><span>${c.tel}${c.correo ? ' · ' + esc(c.correo) : ''}</span>${chipTipo(c)}</div><div class="d-fila"><span>Embudos</span><span>${posDe(c).map(p => `<span class="mini" style="--c:${ET(p.e).c}">${esc(TB(p.b).n)}: ${esc(ET(p.e).n)}</span>`).join(' ') || 'En ninguno'}</span></div><div class="d-fila"><span>Monto en embudos</span><strong>$${posDe(c).reduce((s, p) => s + p.m, 0).toLocaleString('es-MX')}</strong></div><div class="d-fila"><span>Permiso para campañas</span>${chip({ otorgado: 'Acepta campañas', baja: 'Se dio de baja', sin: 'Sin permiso registrado' }[c.consent], c.consent === 'baja' ? 'rojo' : c.consent === 'otorgado' ? 'verde' : 'gris')}</div><h5>Notas</h5>${c.notas.map(n => `<div class="d-nota">${esc(n.t)}</div>`).join('') || '<small class="nota">Sin notas</small>'}`, btn('Abrir chat', 'chatDe', 'primario', `data-id="${c.id}"`)); },
  importar: () => abrirModal('Importar contactos', `<p>Resultado de validar <strong>contactos-octubre.csv</strong> (simulado):</p><div class="resumen"><div class="verde"><small>Nuevos</small><strong>182</strong></div><div><small>Se actualizan</small><strong>41</strong></div><div class="ambar"><small>Duplicados</small><strong>9</strong></div><div class="rojo"><small>Inválidos</small><strong>3</strong></div></div>`, btn('Cancelar', 'cerrarModal') + btn('Importar 223 contactos', 'aviso', 'primario', 'data-t="Importación en proceso: te avisamos al terminar"')),
  exportar: () => aviso('Se descargaría un archivo CSV con lo filtrado'),
  nuevaCampana, revisarCamp, confirmarCamp,
  verCampana: d => verCampana(d.id),
  reprogramarCamp: d => { const k = DB.campanas.find(x => x.id === d.id); abrirModal('Reprogramar ' + esc(k.nombre), `<p>Programada hoy para <strong>${esc(k.fecha)}</strong>.</p>${campoFecha(k.cuando ? aLocal(k.cuando) : '')}`, btn('Regresar', 'verCampana', '', `data-id="${k.id}"`) + btn('Guardar nueva fecha', 'guardarProg', 'primario', `data-id="${k.id}"`)); },
  guardarProg: d => { const k = DB.campanas.find(x => x.id === d.id), c = fechaValida($('#cuandoCamp').value); if (!c) return; k.cuando = c; k.fecha = fechaTxt(c); cerrarModal(); render(); aviso('Reprogramada para ' + k.fecha); },
  cancelarCamp: d => { const k = DB.campanas.find(x => x.id === d.id); if (!confirm(`¿Cancelar la campaña "${k.nombre}"? No se enviará ningún mensaje.`)) return; k.estado = 'Cancelada'; cerrarModal(); render(); aviso('Campaña cancelada'); },
  nuevaEntrada: () => formModal('Campaña de entrada', [{ id: 'n', et: 'Nombre' }, { id: 'k', et: 'Palabras clave (separadas por coma)' }, ...camposEntrada(aLocal(new Date()), aLocal(new Date(Date.now() + 30 * DIA)))], f => { if (!(f.k || '').trim()) return aviso('Una campaña de entrada necesita al menos una palabra clave'); const d = fechasEntrada(f); if (!d) return; DB.campanas.unshift({ id: 'k' + Date.now(), nombre: f.n || 'Campaña de entrada', tipo: 'Entrada', claves: f.k, numero: 'n1', ...d, estado: 'Activa', fecha: '', total: 0, enviados: 0, entregados: 0, leidos: 0, respuestas: 0, clics: 0, bajas: 0, conversiones: 0, errores: 0 }); refrescaEntradas(); embudoDeCampana(DB.campanas[0]); render(); aviso('Campaña de entrada ' + DB.campanas[0].estado.toLowerCase() + ': se creó su embudo'); }, 'Crear campaña'),
  fechasCamp: d => { const k = DB.campanas.find(x => x.id === d.id); formModal('Fechas de ' + esc(k.nombre), camposEntrada(k.inicio, k.fin), f => { const x = fechasEntrada(f); if (!x) return; Object.assign(k, x); refrescaEntradas(); render(); aviso('Fechas guardadas: la campaña queda ' + k.estado.toLowerCase()); }); },
  nuevaLista: () => abrirModal('Nueva lista de difusión', '<label class="campo"><span>Nombre de la lista</span><input id="lstNombre" placeholder="Ej. Clientes de octubre"></label>' + camposCsv(), btn('Cancelar', 'cerrarModal') + btn('Crear lista', 'crearLista', 'primario')),
  crearLista: () => { const n = $('#lstNombre').value.trim(); if (!n) return aviso('Falta el nombre de la lista'); if (!$('#lstCsv').files[0]) return aviso('Falta elegir el archivo CSV'); const l = { id: 'l' + Date.now(), nombre: n, creada: 'hoy', miembros: [] }; cargarCsv(l, () => { DB.listas.push(l); render(); }); },
  plantillaCsv: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFFnombre,apellido,telefono\nMaría,López,8155501234\n'], { type: 'text/csv;charset=utf-8' })); a.download = 'plantilla-lista-difusion.csv'; a.click(); aviso('Plantilla descargada: nombre, apellido, telefono'); },
  verLista: d => { E.buscaLista = ''; verLista(d.id); },
  masCsvLista: d => { const l = DB.listas.find(x => x.id === d.id); abrirModal('Agregar contactos a ' + esc(l.nombre), camposCsv(), btn('Regresar', 'verLista', '', `data-id="${l.id}"`) + btn('Cargar', 'cargarMasLista', 'primario', `data-id="${l.id}"`)); },
  cargarMasLista: d => cargarCsv(DB.listas.find(x => x.id === d.id), render),
  quitarDeLista: d => { const l = DB.listas.find(x => x.id === d.id); l.miembros = l.miembros.filter(m => m.tel !== d.tel); render(); verLista(l.id); },
  editarNumero: d => editarNumero(d.id),
  guardarNumero: d => { const n = N(d.id), f = new FormData($('#formNum')), nombre = (f.get('nombre') || '').trim(), us = f.getAll('u'), dias = f.getAll('d').map(Number); if (!nombre) return aviso('Falta el nombre visible'); if (DB.numeros.some(x => x.id !== n.id && normal(x.nombre) === normal(nombre))) return aviso('Ya hay otro número con ese nombre'); if (!us.length) return aviso('Al menos un usuario debe poder atender este número'); if (dias.length && f.get('cierra') <= f.get('abre')) return aviso('La hora de cierre debe ser después de la de apertura'); n.nombre = nombre; n.cierre = +f.get('cierre'); n.dias = dias; n.abre = f.get('abre'); n.cierra = f.get('cierra'); DB.usuarios.forEach(u => { const tiene = u.numeros.includes(n.id), debe = us.includes(u.id); if (debe && !tiene) u.numeros.push(n.id); if (!debe && tiene) u.numeros = u.numeros.filter(x => x !== n.id); }); cerrarModal(); render(); aviso('Configuración guardada'); },
  desconectarNumero: d => { const n = N(d.id); if (!confirm(`¿Desconectar "${n.nombre}"? Sus conversaciones se conservan en solo lectura y sus campañas se pausan.`)) return; n.estado = 'Desconectado'; cerrarModal(); render(); aviso('Número desconectado'); },
  conectar: () => conectar(),
  conectarPaso: d => conectar(d.p),
  conectarFin: d => { if (d.p === 'QR' && !$('#aceptoQR').checked) return aviso('Debes aceptar el riesgo para continuar'); if (DB.numeros.length >= 3) { cerrarModal(); return aviso('Llegaste al máximo de números de tu plan'); } DB.numeros.push({ id: 'n' + Date.now(), nombre: d.p === 'QR' ? 'Número QR' : ($('#nomNum').value || 'Nuevo'), tel: '+52 81 5550 01' + (10 + DB.numeros.length), tipo: d.p, estado: 'Conectado', calidad: d.p === 'QR' ? '—' : 'Alta', limite: d.p === 'QR' ? 'No aplica' : '250 por día', oficial: false }); cerrarModal(); render(); aviso('Número conectado'); },
  nuevaPlantilla: () => modalPlantilla(),
  tipoPl: d => modalPlantilla(d.t, $('#formPl [name=nombre]').value),
  guardarPl,
  nuevaRespuesta: () => formModal('Nueva respuesta rápida', [{ id: 't', et: 'Título' }, { id: 'm', et: 'Mensaje', tipo: 'area' }], f => { DB.respuestas.push({ id: 'r' + Date.now(), titulo: f.t || 'Sin título', texto: f.m, archivo: '' }); render(); }),
  nuevoAuto: () => formAuto(null),
  editarAuto: d => formAuto(DB.automaticos.find(a => a.id === d.id)),
  nuevoTipo: () => formModal('Nuevo tipo de contacto', [{ id: 'n', et: 'Nombre' }], f => { const n = (f.n || '').trim(); if (!n) return aviso('Falta el nombre'); if (DB.tiposContacto.some(t => normal(t) === normal(n))) return aviso('Ya existe un tipo con ese nombre'); DB.tiposContacto.push(n); render(); aviso('Tipo agregado'); }),
  renombrarTipo: d => { const viejo = DB.tiposContacto[+d.i]; formModal('Renombrar tipo de contacto', [{ id: 'n', et: 'Nombre', valor: viejo }, { tipo: 'nota', et: usanTipo(viejo) + ' contacto(s) con este tipo pasarán al nombre nuevo.' }], f => { const n = (f.n || '').trim(); if (!n) return aviso('Falta el nombre'); if (DB.tiposContacto.some((t, i) => i !== +d.i && normal(t) === normal(n))) return aviso('Ya existe un tipo con ese nombre'); DB.tiposContacto[+d.i] = n; DB.contactos.forEach(c => { if (c.tipo === viejo) c.tipo = n; }); DB.listas.forEach(l => l.miembros.forEach(m => { if (m.tipo === viejo) m.tipo = n; })); render(); aviso('Tipo renombrado'); }); },
  eliminarTipo: d => { const t = DB.tiposContacto[+d.i], n = usanTipo(t); if (!n) { if (!confirm(`¿Eliminar el tipo "${t}"? Ningún contacto lo usa.`)) return; DB.tiposContacto.splice(+d.i, 1); render(); return aviso('Tipo eliminado'); } formModal('Eliminar tipo "' + esc(t) + '"', [{ id: 'a', et: `Hay ${n} ${n === 1 ? 'contacto' : 'contactos'} con este tipo. ¿A qué tipo ${n === 1 ? 'lo paso' : 'los paso'}?`, tipo: 'select', ops: ['Dejarlos sin tipo', ...DB.tiposContacto.filter(x => x !== t)] }, { tipo: 'nota', et: 'Ningún contacto se borra: solo cambia su tipo.' }], f => { const nuevo = f.a === 'Dejarlos sin tipo' ? '' : f.a; DB.contactos.forEach(c => { if (c.tipo === t) c.tipo = nuevo; }); DB.listas.forEach(l => l.miembros.forEach(m => { if (m.tipo === t) m.tipo = nuevo || 'Sin tipo'; })); DB.tiposContacto.splice(DB.tiposContacto.indexOf(t), 1); render(); aviso(`Tipo eliminado: ${n} ${n === 1 ? 'contacto pasó' : 'contactos pasaron'} a ${nuevo || 'Sin tipo'}`); }, 'Eliminar tipo'); },
  nuevoGrupo: () => formModal('Nuevo grupo de tags', [{ id: 'n', et: 'Nombre' }], f => { DB.gruposTags.push({ id: 'g' + Date.now(), nombre: f.n || 'Grupo', tags: [] }); render(); }),
  nuevoTag: d => formModal('Nuevo tag', [{ id: 'n', et: 'Nombre' }, { id: 'c', et: 'Color', tipo: 'color', valor: '#0e9f6e' }], f => { DB.gruposTags.find(g => g.id === d.id).tags.push({ id: 't' + Date.now(), n: f.n || 'Tag', c: f.c }); render(); }),
  nuevaEtapa: () => formModal('Nueva etapa', [{ id: 'n', et: 'Nombre' }, { id: 't', et: 'Resultado', tipo: 'select', ops: ['En proceso', 'Ganada', 'Perdida'] }, { tipo: 'nota', et: 'El resultado le dice a los reportes qué significa llegar a esta etapa: «Ganada» cuenta como venta o conversión, «Perdida» como oportunidad perdida y «En proceso» es un paso intermedio. Son tres valores fijos.' }, { id: 'c', et: 'Color (opcional)', tipo: 'paleta' }], f => { f.t = { 'En proceso': 'abierta', Ganada: 'ganada', Perdida: 'perdida' }[f.t]; const es = TB(E.embudo).etapas, i = es.findIndex(e => e.tipo !== 'abierta'); es.splice(f.t === 'abierta' && i >= 0 ? i : es.length, 0, { id: 'e' + Date.now(), n: f.n || 'Etapa', tipo: f.t, c: f.c || (PALETA.find(p => !es.some(e => e.c === p[0])) || PALETA[0])[0] }); render(); aviso('Etapa agregada a ' + TB(E.embudo).n); }),
  selEmbudo: d => { E.embudo = d.id; E.ruta = 'embudo'; cerrarModal(); render(); },
  gestionarEtapas: () => { const b = TB(E.embudo); abrirModal('Etapas de ' + esc(b.n), b.etapas.map((e, i) => `<div class="d-fila etapa"><span><b>${i + 1}</b> <span class="mini" style="--c:${e.c}">${esc(e.n)}</span></span>${chip(e.tipo === 'abierta' ? 'En proceso' : e.tipo === 'ganada' ? 'Ganada' : 'Perdida', e.tipo === 'ganada' ? 'verde' : e.tipo === 'perdida' ? 'gris' : 'azul')}</div>`).join('') + '<p class="nota">A la derecha de cada etapa está su resultado: En proceso, Ganada o Perdida. Es lo que usan los reportes para saber qué etapas cuentan como venta. En la aplicación real aquí también se renombran, reordenan, se les cambia el resultado y se desactivan.</p>' + (b.tipo === 'general' ? `<h5 style="margin-top:14px">Números que atiende</h5><p>${b.numero ? 'Solo ' + esc(N(b.numero).nombre) + ': sus palabras clave solo cuentan en los chats de ese número.' : 'Todos los números: sus palabras clave cuentan en cualquier chat.'}</p><h5 style="margin-top:14px">Palabras clave</h5><p>${(b.claves || []).length ? b.claves.map(k => chip(k, 'azul')).join(' ') : '<small class="nota">Ninguna: a este embudo solo se entra a mano.</small>'}</p><p class="nota">Quien escriba una de estas palabras entra solo a la etapa ${esc(b.etapas[0].n)}.</p>` : ''), btn('Cerrar', 'cerrarModal') + (b.tipo === 'general' ? btn('Editar palabras clave', 'editarClaves') : '') + btn('+ Etapa', 'nuevaEtapa', 'primario')); },
  editarClaves: () => { const b = TB(E.embudo); formModal('Palabras clave de ' + esc(b.n), [{ id: 'k', et: 'Separadas por coma', valor: (b.claves || []).join(', ') }, { tipo: 'nota', et: 'Los contactos que ya están en el embudo no se mueven. Solo aplica a los mensajes que lleguen desde ahora.' }], f => { b.claves = (f.k || '').split(',').map(x => x.trim()).filter(Boolean); render(); aviso('Palabras clave guardadas'); }); },
  nuevoEmbudo: () => formModal('Nuevo embudo', [{ id: 'n', et: 'Nombre' }, { id: 'd', et: 'Descripción' }, { id: 'c', et: 'Copiar etapas de', tipo: 'select', ops: ['Ninguno (empezar con Nuevo, En proceso, Ganado, Perdido)', ...DB.embudos.map(b => b.n)] }, { id: 'nu', et: 'Este embudo atiende las conversaciones de', tipo: 'select', ops: ['Todos los números', ...DB.numeros.map(n => 'Solo el número ' + n.nombre)] }, { tipo: 'nota', et: 'No elige a qué embudo va un cliente: limita este embudo a un número. Si eliges un solo número, las palabras clave de abajo solo cuentan en los chats de ese número y el embudo solo muestra sus conversaciones. Con «Todos los números» cuentan en cualquiera.' }, { id: 'k', et: 'Palabras clave, separadas por coma (opcional)', ph: 'precio, comprar, cotización' }, { tipo: 'nota', et: 'Cuando un cliente escriba una de estas palabras, entra solo a la primera etapa de este embudo. No distingue mayúsculas ni acentos y busca la palabra completa.' }], f => { const id = 'b' + Date.now(), o = DB.embudos.find(b => b.n === f.c); const es = (o ? o.etapas.map(e => [e.n, e.tipo, e.c]) : [['Nuevo', 'abierta', '#2563eb'], ['En proceso', 'abierta', '#f59e0b'], ['Ganado', 'ganada', '#0e9f6e'], ['Perdido', 'perdida', '#94a3b8']]).map((e, i) => ({ id: id + 's' + i, n: e[0], tipo: e[1], c: e[2] })); DB.embudos.push({ id, n: f.n || 'Embudo nuevo', tipo: 'general', numero: (DB.numeros.find(n => 'Solo el número ' + n.nombre === f.nu) || {}).id || null, claves: (f.k || '').split(',').map(x => x.trim()).filter(Boolean), desc: f.d || 'Agrega contactos desde el chat con "Agregar a embudo".', etapas: es }); E.embudo = id; E.ruta = 'embudo'; render(); aviso('Embudo creado'); }, 'Crear embudo'),
  agregarEmbudo: () => { const c = C(CONV().contacto), ya = posDe(c).map(p => p.b), libres = DB.embudos.filter(b => b.tipo !== 'tickets' && !ya.includes(b.id)); abrirModal('Agregar a embudo', libres.length ? `<p class="nota">Entra en la primera etapa; después la cambias desde aquí mismo.</p><div class="opciones">${libres.map(b => `<a data-accion="agregarA" data-b="${b.id}"><strong>${esc(b.n)}</strong><small>${b.etapas.map(e => esc(e.n)).join(' → ')}</small></a>`).join('')}</div>` : '<p>Este contacto ya está en todos los embudos.</p>'); },
  agregarA: d => { const c = C(CONV().contacto), b = TB(d.b); DB.posiciones.push({ c: c.id, b: b.id, e: b.etapas[0].id, m: 0, dias: 0 }); cerrarModal(); render(); aviso(`${c.nombre} entró a ${b.n}`); },
  quitarEmbudo: d => { const c = C(CONV().contacto); DB.posiciones = DB.posiciones.filter(p => !(p.c === c.id && p.b === d.b)); render(); aviso('Quitado de ' + TB(d.b).n); },
  nuevaBaja: () => formModal('Baja manual', [{ id: 't', et: 'Teléfono' }, { id: 'm', et: 'Motivo', tipo: 'area' }], f => { DB.bajas.unshift({ tel: f.t, contacto: 'Sin nombre', fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), origen: 'Manual', campana: '—' }); render(); }),
  quitarBaja: d => { if (confirm('¿Quitar esta baja? Queda registrado en la bitácora.')) { DB.bajas.splice(+d.i, 1); render(); } },
  nuevoUsuario: () => { if (DB.usuarios.length >= DB.empresa.usuariosMax) return aviso('Llegaste al máximo de usuarios de tu plan'); formModal('Invitar usuario', [{ id: 'n', et: 'Nombre' }, { id: 'c', et: 'Correo', tipo: 'email' }, { id: 'r', et: 'Rol', tipo: 'select', ops: ['Agente', 'Supervisor', 'Administrador'] }, { id: 's', et: 'Sucursal', tipo: 'select', ops: ['Matriz', 'Saltillo'] }], f => { DB.usuarios.push({ id: 'u' + Date.now(), nombre: f.n || 'Usuario nuevo', ini: iniciales(f.n || 'UN'), rol: f.r, sucursal: f.s, disp: false, correo: f.c, numeros: ['n1'] }); render(); aviso('Invitación enviada por correo'); }, 'Enviar invitación'); },
  empAccion: d => { const e = DB.empresas[+d.i]; e.estado = d.e; if (d.e === 'Activa') { e.plan = e.plan === 'Sin paquete' || e.plan === 'Prueba gratis' ? 'Básico' : e.plan; e.fin = '—'; } render(); aviso(`${e.nombre}: ${d.e}`); },
  empExtender: d => { const e = DB.empresas[+d.i]; e.fin = '17 oct 2026'; render(); aviso('Prueba extendida 7 días'); }
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-accion]'); if (!el) return;
  const fn = A[el.dataset.accion]; if (fn) { ev.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('change', ev => {
  const el = ev.target, k = el.dataset.cambio; if (!k) return;
  if (k === 'numero') E.numero = el.value;
  if (k === 'filtro') E.f[el.dataset.k] = el.value;
  if (k === 'filtroBool') E.f[el.dataset.k] = el.checked;
  if (k === 'filtroTag') E.f.tags = el.checked ? [...E.f.tags, el.value] : E.f.tags.filter(t => t !== el.value);
  if (k === 'etapa') moverTarjeta(el.dataset.b, el.dataset.id, el.value);
  if (k === 'embudo') E.embudo = el.value;
  if (k === 'tbPre') { E.tb.pre = el.value; if (el.value === 'per' && !E.tb.desde) { E.tb.desde = aLocal(new Date(hoy0() - 29 * DIA)).slice(0, 10); E.tb.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'tbDesde') E.tb.desde = el.value;
  if (k === 'tbHasta') E.tb.hasta = el.value;
  if (k === 'filtro' && el.dataset.k === 'embudo') E.f.etapa = '';
  if (k === 'autoActivo') DB.automaticos.find(a => a.id === el.dataset.id).activo = el.checked;
  if (k === 'disp') U(E.usuario).disp = el.checked;
  if (k === 'tipoPl') return modalPlantilla(el.value, $('#formPl [name=nombre]').value);
  if (k === 'tkPre') { E.tk.pre = el.value; if (el.value === 'per' && !E.tk.desde) { E.tk.desde = aLocal(new Date(hoy0() - 6 * DIA)).slice(0, 10); E.tk.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'tkDesde') E.tk.desde = el.value;
  if (k === 'tkHasta') E.tk.hasta = el.value;
  if (k === 'repPre') { E.rep.pre = el.value; if (el.value === 'per' && !E.rep.desde) { E.rep.desde = aLocal(new Date(hoy0() - 13 * DIA)).slice(0, 10); E.rep.hasta = aLocal(hoy0()).slice(0, 10); } }
  if (k === 'repDesde') E.rep.desde = el.value;
  if (k === 'repHasta') E.rep.hasta = el.value;
  if (k === 'envioCamp') return $('#progCamp').classList.toggle('oculto', !el.value.startsWith('Programar'));
  if (k === 'previaCamp') return $('#previaCamp').innerHTML = previaPlantilla(DB.plantillas.find(p => p.nombre === el.value));
  render();
});
document.addEventListener('input', ev => {
  if (ev.target.closest('#modal form')) aplicarSi();
  if (ev.target.closest('#formPl') && ev.target.name !== 'tipo') pintaPreviaPl();
  if (ev.target.closest('#formEnv')) pintaEnv();
  if (ev.target.id === 'buscaLista') { E.buscaLista = ev.target.value; $('#filasLista').innerHTML = filasLista(DB.listas.find(l => l.id === E.listaAbierta)); }
  if (ev.target.id === 'busca') { E.busca = ev.target.value; $('#listaConvs').innerHTML = filasConv(); }
  if (ev.target.id === 'buscaContacto') { E.buscaContacto = ev.target.value; render(); const b = $('#buscaContacto'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  if (ev.target.id === 'texto' && ev.target.value === '/') { ev.target.value = ''; A.rapidas(); }
});
document.addEventListener('keydown', ev => {
  if (ev.target.id === 'texto' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); A.enviar(); }
  if (ev.key === 'Escape') cerrarModal();
});

function moverTarjeta(idEmbudo, id, idEtapa) {
  const b = TB(idEmbudo), e = b.etapas.find(x => x.id === idEtapa);
  if (b.tipo === 'tickets') {
    const k = DB.tickets.find(x => String(x.id) === String(id)); if (k.etapa === idEtapa) return;
    k.etapa = idEtapa; k.estado = e.tipo !== 'abierta' ? 'Cerrado' : b.etapas[0].id === idEtapa ? 'Abierto' : 'En proceso';
    return aviso(`Ticket #${k.id} pasó a ${e.n}: queda ${k.estado.toLowerCase()}`);
  }
  const c = C(id), p = DB.posiciones.find(x => x.c === id && x.b === idEmbudo);
  if (!p || p.e === idEtapa) return;
  p.e = idEtapa;
  const v = DB.conversaciones.find(x => x.contacto === c.id);
  if (v) v.msgs.push({ de: 's', t: `${U(E.usuario).nombre} movió la etapa a ${e.n} en ${b.n}`, h: ahora() });
  aviso(e.tipo === 'ganada' ? `${c.nombre} pasó a ${e.n}: cuenta como conversión` : `${c.nombre} pasó a ${e.n} en ${b.n}`);
}
let arrastrado = null;
document.addEventListener('dragstart', ev => { const t = ev.target.closest('.tarjeta'); if (t) { arrastrado = t.dataset.id; t.classList.add('arrastrando'); } });
document.addEventListener('dragover', ev => { const c = ev.target.closest('.columna'); if (c && arrastrado) { ev.preventDefault(); c.classList.add('sobre'); } });
document.addEventListener('dragleave', ev => { const c = ev.target.closest('.columna'); if (c) c.classList.remove('sobre'); });
document.addEventListener('drop', ev => { const c = ev.target.closest('.columna'); if (c && arrastrado) { ev.preventDefault(); moverTarjeta(E.embudo, arrastrado, c.dataset.etapa); arrastrado = null; render(); } });
document.addEventListener('dragend', () => { arrastrado = null; });

$('#selRol').addEventListener('change', ev => { E.rol = ev.target.value; E.usuario = USUARIO_POR_ROL[E.rol]; if (E.ruta !== 'login') E.ruta = E.rol === 'P' ? 'empresas' : 'bandeja'; E.panel = 'lista'; render(); });
$('#selVista').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; E.movil = b.dataset.vista === 'movil'; E.panel = 'lista'; [...$('#selVista').children].forEach(x => x.classList.toggle('activo', x === b)); render(); });

try { E.menuCol = !!localStorage.getItem('crmMenuCol'); } catch (e) {}
// Embudo: abre con el primer embudo (o el único que haya) y con un mes de fechas ya puesto.
{ const h = hoy0(), d = new Date(h.getFullYear(), h.getMonth() - 1, h.getDate()); E.tb = { pre: 'per', desde: aLocal(d).slice(0, 10), hasta: aLocal(h).slice(0, 10) }; E.embudo = DB.embudos[0].id; }
render();
