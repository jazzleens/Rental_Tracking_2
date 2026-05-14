
const SUPABASE_URL = 'https://knmpekpurhnkvkgvtosl.supabase.co' 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubXBla3B1cmhua3ZrZ3Z0b3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjkxMjksImV4cCI6MjA5MzkwNTEyOX0.pBx_OtT7Z6mXrAg0j5M_dJ3r3d2AGMQrwBiGw_a7-58'

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)
// ── CONSTANTS ──────────────────────────────────────────────────
const COLS = ['#c8a96e', '#7eb8a4', '#e07b6a', '#8b82c4', '#6ab0d4', '#b88dc4'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MO_F = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INC_CATS = ['Rent', 'Late Fee', 'Security Deposit', 'Other Income'];
const EXP_CATS = ['Mortgage / Interest', 'Maintenance & Repairs', 'Property Tax', 'Insurance',
  'Utilities — Gas', 'Utilities — Electricity', 'Utilities — Water', 'Utilities — Other',
  'Annual Inspection Fee', 'Code Violation Fine', 'Management Fee', 'Misc Expense'];
const SCHED_E = {
  'Mortgage / Interest': 'Line 13 — Mortgage interest',
  'Maintenance & Repairs': 'Line 14 — Repairs', 'Property Tax': 'Line 16 — Taxes',
  'Insurance': 'Line 9 — Insurance',
  'Utilities — Gas': 'Line 17 — Utilities (Gas)',
  'Utilities — Electricity': 'Line 17 — Utilities (Electricity)',
  'Utilities — Water': 'Line 17 — Utilities (Water)',
  'Utilities — Other': 'Line 17 — Utilities',
  'Annual Inspection Fee': 'Line 19 — Inspections',
  'Code Violation Fine': 'Line 19 — Note: fines generally NOT deductible',
  'Management Fee': 'Line 11 — Management fees',
  'Misc Expense': 'Line 19 — Other expenses'
};

// ── STATE ──────────────────────────────────────────────────────
let DB = { props: [], units: [], txns: [], pays: {}, viols: [], _id: 1000 };
function nid() { return ++DB._id; }

// ── HELPERS ────────────────────────────────────────────────────
function getYr() { return parseInt(document.getElementById('yr-sel').value); }
function fmt(n) { return '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().split('T')[0]; }
function getProp(id) { return DB.props.find(p => p.id === id); }
function pCol(id) { const i = DB.props.findIndex(p => p.id === id); return COLS[Math.max(i, 0) % COLS.length]; }
function yrTxns(yr) { return DB.txns.filter(t => t.date && new Date(t.date).getFullYear() === yr); }
function pkey(uid, tid, yr, mo) { return `${uid}_${tid}_${yr}_${mo}`; }
function getPay(uid, tid, yr, mo) { return DB.pays[pkey(uid, tid, yr, mo)] || null; }
function gv(id) { return parseFloat(document.getElementById(id).value) || 0; }
function sv(id, v) { document.getElementById(id).value = (v === null || v === undefined) ? '' : v; }
function fillSel(id, arr, lFn, vFn) { document.getElementById(id).innerHTML = arr.map(x => `<option value="${vFn(x)}">${lFn(x)}</option>`).join(''); }

// ── VIEW ───────────────────────────────────────────────────────
let curView = 'dashboard', txnFilter = 'all';
const VM = {
  dashboard: ['Dashboard', 'Overview for all properties'],
  properties: ['Properties & Units', 'Manage your properties and units'],
  rentledger: ['Rent Ledger', 'Payments auto-post to Transactions'],
  transactions: ['Transactions', 'All income & expenses'],
  cashflow: ['Cash Flow', 'Monthly performance'],
  violations: ['Violations & Inspections', 'Fines, notices, annual fees'],
  taxreport: ['Tax Report', 'Schedule E Summary']
};

function setView(v) {
  curView = v;
  document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.ni').forEach(e => e.classList.toggle('active',
    e.getAttribute('onclick') && e.getAttribute('onclick').includes("'" + v + "'")));
  document.getElementById('v-title').textContent = VM[v][0];
  document.getElementById('v-sub').textContent = VM[v][1];
  renderAll();
}

// ── OVERLAYS ───────────────────────────────────────────────────
function openOv(id) { document.getElementById('modal-' + id).classList.add('open'); }
function closeOv(id) { document.getElementById('modal-' + id).classList.remove('open'); }
document.querySelectorAll('.ov').forEach(el => el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); }));

// ── PROPERTY MODAL ─────────────────────────────────────────────
let editPropId = null;
function openPropModal(id) {
  editPropId = id;
  const p = id != null ? DB.props.find(x => x.id === id) : null;
  document.getElementById('prop-title').textContent = p ? 'Edit Property' : 'Add Property';
  document.getElementById('prop-save-btn').textContent = p ? 'Update Property' : 'Add Property';
  sv('p-name', p ? p.name : ''); sv('p-addr', p ? p.address : ''); sv('p-city', p ? p.city : '');
  sv('p-price', p ? p.price : ''); sv('p-rent', p ? p.rent : '');
  sv('p-due', p ? p.due : 1); sv('p-lateday', p ? p.lateFeeDay : 8); sv('p-latefee', p ? p.lateFee : 0);
  openOv('prop');
}

async function saveProp() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { toast('Enter property name', true); return; }
  const data = {
    name, address: document.getElementById('p-addr').value, city: document.getElementById('p-city').value,
    price: parseFloat(document.getElementById('p-price').value) || 0,
    rent: parseFloat(document.getElementById('p-rent').value) || 0,
    due: parseInt(document.getElementById('p-due').value) || 1,
    lateFeeDay: parseInt(document.getElementById('p-lateday').value) || 8,
    lateFee: parseFloat(document.getElementById('p-latefee').value) || 0
  };
  if (editPropId != null) {

  const { error } = await supabaseClient
    .from('properties')
    .update({
      name: data.name,
      address: data.address,
      city: data.city,
      price: data.price,
      rent: data.rent,
      due: data.due,
      late_fee_day: data.lateFeeDay,
      late_fee: data.lateFee
    })
    .eq('id', editPropId)

  if (error) {
    console.error(error)
    toast('Update failed', true)
    return
  }

  toast('Property updated ✓')

} else {

  const { error } = await supabaseClient
    .from('properties')
    .insert([
      {
        name: data.name,
        address: data.address,
        city: data.city,
        price: data.price,
        rent: data.rent,
        due: data.due,
        late_fee_day: data.lateFeeDay,
        late_fee: data.lateFee
      }
    ])

  if (error) {
    console.error(error)
    toast('Save failed', true)
    return
  }

  toast('Property added ✓')
}
  editPropId = null;
  closeOv('prop');

  await loadProperties();
}

async function deleteProp(id) {
  if (!confirm('Delete this property? All associated units and transactions will remain but the property reference will be lost.')) return

  const { error } = await supabaseClient
    .from('properties')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteProp error:', error)
    toast('Delete failed', true)
    return
  }

  toast('Property deleted')
  await loadProperties()
  renderAll()
}

// ── UNIT MODAL ─────────────────────────────────────────────────
let editUnitId = null, _tc = 0;
function openUnitModal(id) {
  if (!DB.props.length) { toast('Add a property first', true); return; }
  editUnitId = id;
  const u = id != null ? DB.units.find(x => x.id === id) : null;
  document.getElementById('unit-title').textContent = u ? 'Edit Unit' : 'Add Unit';
  document.getElementById('unit-save-btn').textContent = u ? 'Update Unit' : 'Save Unit';
  fillSel('u-prop', DB.props, p => p.name, p => p.id);
  if (u) document.getElementById('u-prop').value = u.propId;
  sv('u-name', u ? u.name : ''); sv('u-start', u ? u.start : today()); sv('u-end', u ? u.end : '');
  sv('u-due', u ? u.due : 1); sv('u-lateday', u ? u.lateFeeDay : 8); sv('u-latefee', u ? u.lateFeeAmt : 0);
  // pre-fill tenants
  document.getElementById('t-fields').innerHTML = '';
  if (u && u.tenants.length) {
    u.tenants.forEach(t => { addTF(t.name, t.share, t.id); });
  }
  openOv('unit');
}

function addTF(name, share, tid) {
  _tc++; const id = 'tf' + _tc;
  const d = document.createElement('div'); d.className = 'te'; d.id = id;
  d.innerHTML = `<span class="rb" onclick="document.getElementById('${id}').remove()">×</span>
    <div class="fr">
      <div class="fg"><label class="fl">Tenant Name</label><input class="fi" data-role="tname" placeholder="Full name" value="${name || ''}"></div>
      <div class="fg"><label class="fl">Monthly Share ($)</label><input class="fi" type="number" data-role="tshare" placeholder="0.00" step="0.01" min="0" value="${share || ''}"></div>
    </div>
    <input type="hidden" data-role="tid" value="${tid || ''}">`;
  document.getElementById('t-fields').appendChild(d);
}

async function saveUnit() {
  const propId = parseInt(document.getElementById('u-prop').value)
  const name = document.getElementById('u-name').value.trim()
  if (!name) { toast('Enter unit name', true); return; }
  
  const tenants = []
  document.querySelectorAll('#t-fields .te').forEach(el => {
    const n = el.querySelector('[data-role="tname"]').value.trim()
    const s = parseFloat(el.querySelector('[data-role="tshare"]').value)
    if (n) tenants.push({ name: n, share: s || 0 })
  })
  
  const data = {
    propId,
    name,
    start: document.getElementById('u-start').value,
    end: document.getElementById('u-end').value,
    due: parseInt(document.getElementById('u-due').value) || 1,
    lateFeeDay: parseInt(document.getElementById('u-lateday').value) || 8,
    lateFeeAmt: parseFloat(document.getElementById('u-latefee').value) || 0,
    tenants
  }
  
  if (editUnitId != null) {
    // Update existing unit
    const { error: unitError } = await supabaseClient
      .from('units')
      .update({
        name: data.name,
        start_date: data.start,
        end_date: data.end,
        due: data.due,
        late_fee_day: data.lateFeeDay,
        late_fee_amt: data.lateFeeAmt
      })
      .eq('id', editUnitId)

    if (unitError) {
      console.error('saveUnit update error:', unitError)
      toast('Update failed', true)
      return
    }

    // Delete and re-add tenants
    const { error: deleteError } = await supabaseClient
      .from('tenants')
      .delete()
      .eq('unit_id', editUnitId)

    if (deleteError) {
      console.error('deleteTenantsError:', deleteError)
      toast('Tenant update failed', true)
      return
    }

    // Insert new tenants
    if (data.tenants.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('tenants')
        .insert(
          data.tenants.map(t => ({
            unit_id: editUnitId,
            name: t.name,
            share: t.share
          }))
        )

      if (insertError) {
        console.error('insertTenants error:', insertError)
        toast('Tenant save failed', true)
        return
      }
    }

    toast('Unit updated ✓')
  } else {
    // Insert new unit (no id)
    const { error: unitError, data: unitData } = await supabaseClient
      .from('units')
      .insert([
        {
          prop_id: data.propId,
          name: data.name,
          start_date: data.start,
          end_date: data.end,
          due: data.due,
          late_fee_day: data.lateFeeDay,
          late_fee_amt: data.lateFeeAmt
        }
      ])
      .select()

    if (unitError) {
      console.error('saveUnit insert error:', unitError)
      toast('Save failed', true)
      return
    }

    const newUnitId = unitData && unitData[0] ? unitData[0].id : null

    // Insert tenants
    if (data.tenants.length > 0 && newUnitId) {
      const { error: tenantError } = await supabaseClient
        .from('tenants')
        .insert(
          data.tenants.map(t => ({
            unit_id: newUnitId,
            name: t.name,
            share: t.share
          }))
        )

      if (tenantError) {
        console.error('saveTenants error:', tenantError)
        toast('Tenant save failed', true)
        return
      }
    }

    toast('Unit added ✓')
  }

  editUnitId = null
  closeOv('unit')
  await loadUnits()
  renderAll()
}

async function deleteUnit(id) {
  if (!confirm('Delete this unit and all its tenant records?')) return
  
  const { error } = await supabaseClient
    .from('units')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteUnit error:', error)
    toast('Delete failed', true)
    return
  }

  toast('Unit deleted')
  await loadUnits()
  renderAll()
}

// ── TRANSACTION MODAL ──────────────────────────────────────────
let editTxnId = null;
function openTxnModal(id) {
  if (!DB.props.length) { toast('Add a property first', true); return; }
  editTxnId = id;
  fillSel('t-prop', DB.props, p => p.name, p => p.id);
  const t = id != null ? DB.txns.find(x => x.id === id) : null;
  document.getElementById('txn-title').textContent = t ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('txn-save-btn').textContent = t ? 'Update Transaction' : 'Save Transaction';
  if (t) {
    sv('t-type', t.type); sv('t-date', t.date); sv('t-amount', t.amount);
    document.getElementById('t-prop').value = t.property;
    refreshUnitSel(); sv('t-unit', t.unitId || '');
    onTypeChange(t.category);
    sv('t-vendor', t.vendor || ''); sv('t-desc', t.desc || '');
  } else {
    sv('t-type', 'income'); sv('t-date', today()); sv('t-amount', ''); sv('t-desc', ''); sv('t-vendor', '');
    refreshUnitSel(); onTypeChange(null);
  }
  openOv('txn');
}

function refreshUnitSel() {
  const pid = parseInt(document.getElementById('t-prop').value);
  const pu = DB.units.filter(u => u.propId === pid);
  document.getElementById('t-unit').innerHTML =
    `<option value="">— General / All units —</option>` + pu.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
}

function onTypeChange(keepCat) {
  const isExp = document.getElementById('t-type').value === 'expense';
  document.getElementById('t-cat').innerHTML = (isExp ? EXP_CATS : INC_CATS).map(c => `<option>${c}</option>`).join('');
  if (keepCat) document.getElementById('t-cat').value = keepCat;
  onCatChange();
}

function onCatChange() {
  const isExp = document.getElementById('t-type').value === 'expense';
  document.getElementById('grp-vendor').style.display = isExp ? '' : 'none';
}

async function saveTxn() {
  const amount = parseFloat(document.getElementById('t-amount').value)
  if (!amount || amount <= 0) { toast('Enter a valid amount', true); return; }
  
  const propId = parseInt(document.getElementById('t-prop').value)
  const unitVal = document.getElementById('t-unit').value
  const unitId = unitVal ? parseInt(unitVal) : null
  
  const rec = {
    type: document.getElementById('t-type').value,
    date: document.getElementById('t-date').value,
    amount,
    property: propId,
    unit_id: unitId,
    category: document.getElementById('t-cat').value,
    vendor: document.getElementById('t-vendor').value,
    description: document.getElementById('t-desc').value || '—',
    source: 'manual'
  }
  
  if (editTxnId != null) {
    // Update transaction
    const { error } = await supabaseClient
      .from('transactions')
      .update(rec)
      .eq('id', editTxnId)

    if (error) {
      console.error('saveTxn update error:', error)
      toast('Update failed', true)
      return
    }

    toast('Transaction updated ✓')
  } else {
    // Insert transaction (no id)
    const { error } = await supabaseClient
      .from('transactions')
      .insert([rec])

    if (error) {
      console.error('saveTxn insert error:', error)
      toast('Save failed', true)
      return
    }

    toast('Transaction saved ✓')
  }
  
  editTxnId = null
  closeOv('txn')
  await loadTransactions()
  renderAll()
}

async function delTxn(id) {
  if (!confirm('Delete this transaction?')) return
  
  const { error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('delTxn error:', error)
    toast('Delete failed', true)
    return
  }

  toast('Deleted')
  await loadTransactions()
  renderAll()
}

function setTF(f, el) {
  txnFilter = f;
  document.querySelectorAll('#txn-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active'); renderTxns();
}

// ── VIOLATION MODAL ────────────────────────────────────────────
let editViolId = null;
function openViolModal(id) {
  if (!DB.props.length) { toast('Add a property first', true); return; }
  editViolId = id;
  const v = id != null ? DB.viols.find(x => x.id === id) : null;
  document.getElementById('viol-title').textContent = v ? 'Edit Violation / Inspection' : 'Add Violation / Inspection';
  document.getElementById('viol-save-btn').textContent = v ? 'Update' : 'Save';
  fillSel('vi-prop', DB.props, p => p.name, p => p.id);
  if (v) {
    sv('vi-type', v.type); sv('vi-date', v.date); sv('vi-amount', v.amount);
    document.getElementById('vi-prop').value = v.propId;
    sv('vi-code', v.code || ''); sv('vi-notes', v.notes || '');
    if (v.status) document.getElementById('vi-status').value = v.status;
  } else {
    document.getElementById('vi-type').value = 'violation';
    sv('vi-date', today()); sv('vi-amount', ''); sv('vi-code', ''); sv('vi-notes', '');
  }
  toggleVF(); openOv('viol');
}

function toggleVF() {
  document.getElementById('vi-extra').style.display =
    document.getElementById('vi-type').value === 'violation' ? '' : 'none';
}

async function saveViol() {
  const amount = parseFloat(document.getElementById('vi-amount').value) || 0
  const type = document.getElementById('vi-type').value
  const data = {
    prop_id: parseInt(document.getElementById('vi-prop').value),
    type,
    date: document.getElementById('vi-date').value,
    amount,
    code: document.getElementById('vi-code').value,
    status: type === 'violation' ? document.getElementById('vi-status').value : 'resolved',
    notes: document.getElementById('vi-notes').value
  }
  
  if (editViolId != null) {
    // Update violation
    const { error } = await supabaseClient
      .from('violations')
      .update(data)
      .eq('id', editViolId)

    if (error) {
      console.error('saveViol update error:', error)
      toast('Update failed', true)
      return
    }

    toast('Updated ✓')
  } else {
    // Insert violation (no id)
    const { error: violError, data: violData } = await supabaseClient
      .from('violations')
      .insert([data])
      .select()

    if (violError) {
      console.error('saveViol insert error:', violError)
      toast('Save failed', true)
      return
    }

    // Auto-create transaction if amount > 0
    if (amount > 0) {
      const cat = type === 'violation' ? 'Code Violation Fine' : type === 'inspection' ? 'Annual Inspection Fee' : 'Misc Expense'
      const { error: txnError } = await supabaseClient
        .from('transactions')
        .insert([
          {
            type: 'expense',
            date: data.date,
            amount,
            property: data.prop_id,
            unit_id: null,
            category: cat,
            vendor: '',
            description: data.notes || cat,
            source: 'violation'
          }
        ])

      if (txnError) {
        console.error('saveViol transaction error:', txnError)
        toast('Violation saved but transaction failed', true)
      }
    }

    toast('Saved ✓')
  }

  editViolId = null
  closeOv('viol')
  await loadViolations()
  await loadTransactions()
  renderAll()
}

async function toggleVS(id) {
  const v = DB.viols.find(x => x.id === id)
  if (!v) return

  const newStatus = v.status === 'resolved' ? 'open' : 'resolved'
  const { error } = await supabaseClient
    .from('violations')
    .update({ status: newStatus })
    .eq('id', id)

  if (error) {
    console.error('toggleVS error:', error)
    toast('Update failed', true)
    return
  }

  await loadViolations()
  renderAll()
}

async function deleteViol(id) {
  if (!confirm('Delete this entry?')) return
  
  const { error } = await supabaseClient
    .from('violations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteViol error:', error)
    toast('Delete failed', true)
    return
  }

  toast('Deleted')
  await loadViolations()
  renderAll()
}

// ── PAYMENT MODAL ──────────────────────────────────────────────
let pendPay = null;
function openPayModal(uid, tid, yr, mo) {
  const unit = DB.units.find(u => u.id === uid);
  const tenant = unit && unit.tenants.find(t => t.id === tid);
  if (!unit || !tenant) { toast('Could not find unit/tenant', true); return; }
  const prop = getProp(unit.propId);
  const ex = getPay(uid, tid, yr, mo);
  const prevMo = mo === 0 ? 11 : mo - 1, prevYr = mo === 0 ? yr - 1 : yr;
  const prevPay = getPay(uid, tid, prevYr, prevMo);
  const prevBal = prevPay ? Math.max(0, prevPay.remaining || 0) : 0;
  const now = new Date();
  const isCurrentMonth = (yr === now.getFullYear() && mo === now.getMonth());
  const lateDay = unit.lateFeeDay || 8, lateAmt = unit.lateFeeAmt || 0;
  // Auto-apply late fee on top of rent if past threshold day
  const isLate = isCurrentMonth && now.getDate() > lateDay && lateAmt > 0;
  const autoLate = (!ex && isLate) ? lateAmt : 0;
  // Total shown to tenant = rent + late fee pre-added
  const baseRent = tenant.share;
  const totalWithLate = baseRent + (autoLate);
  const isFeb = (mo === 1);
  document.getElementById('insp-b').style.display = isFeb ? 'inline-block' : 'none';
  pendPay = { uid, tid, yr, mo, share: tenant.share, propId: unit.propId };
  document.getElementById('pay-ctx').innerHTML =
    `<strong>${tenant.name}</strong> &nbsp;·&nbsp; <strong>${MO_F[mo]} ${yr}</strong><br>` +
    `<span style="color:var(--tx3)">${prop ? prop.name : '—'} · ${unit.name} &nbsp;·&nbsp; Late fee after day <strong>${lateDay}</strong>${lateAmt > 0 ? ` (${fmt(lateAmt)})` : ''}</span>` +
    (prevBal > 0 ? `<br><span style="color:var(--yw)">⚠ Previous month balance: <strong>${fmt(prevBal)}</strong></span>` : '');
  let lateHtml = '';
  if (!ex) {
    if (autoLate > 0) lateHtml = `<div class="alert aw" style="margin-top:8px">⚠ Late fee of <strong>${fmt(autoLate)}</strong> auto-applied (today is day ${now.getDate()}, past day ${lateDay} threshold). Adjust below if needed.</div>`;
    else if (lateAmt > 0 && isCurrentMonth) lateHtml = `<div class="alert ai" style="margin-top:8px">✓ No late fee — payment before day ${lateDay} threshold.</div>`;
  }
  document.getElementById('late-notice').innerHTML = lateHtml;
  document.getElementById('late-hint').textContent = lateAmt > 0 ? `Configured: ${fmt(lateAmt)} after day ${lateDay}` : '';
  const g = k => ex ? ex[k] : null;
  sv('py-rent', g('rent') ?? tenant.share); sv('py-prev', g('prev') ?? prevBal.toFixed(2));
  sv('py-late', g('late') ?? autoLate); sv('py-other', g('other') ?? 0);
  sv('py-gas', g('gas') ?? 0); sv('py-elec', g('elec') ?? 0); sv('py-water', g('water') ?? 0); sv('py-insp', g('insp') ?? 0);
  sv('py-recv', g('received') ?? ''); sv('py-date', g('date') ?? today());
  sv('py-mode', g('mode') ?? 'Cash'); sv('py-status', g('status') ?? 'paid'); sv('py-notes', g('notes') ?? '');
  recalc(); openOv('pay');
}

function recalc() {
  const total = gv('py-rent') + gv('py-prev') + gv('py-late') + gv('py-other') + gv('py-gas') + gv('py-elec') + gv('py-water') + gv('py-insp');
  const recv = gv('py-recv'), rem = Math.max(0, total - recv);
  document.getElementById('d-total').textContent = fmt(total);
  document.getElementById('d-rem').textContent = fmt(rem);
  document.getElementById('d-rem').style.color = rem > 0 ? 'var(--rd)' : 'var(--gn)';
}

async function savePay() {
  if (!pendPay) { toast('No payment pending', true); return; }
  const { uid, tid, yr, mo, propId } = pendPay
  const rent = gv('py-rent'), prev = gv('py-prev'), late = gv('py-late'), other = gv('py-other')
  const gas = gv('py-gas'), elec = gv('py-elec'), water = gv('py-water'), insp = gv('py-insp')
  const total = rent + prev + late + other + gas + elec + water + insp
  const received = gv('py-recv'), remaining = Math.max(0, total - received)
  const date = document.getElementById('py-date').value
  const mode = document.getElementById('py-mode').value
  const status = document.getElementById('py-status').value
  const notes = document.getElementById('py-notes').value
  const unit = DB.units.find(u => u.id === uid)
  const tenant = unit && unit.tenants.find(t => t.id === tid)
  const unitName = unit ? unit.name : ''
  const tenantName = tenant ? tenant.name : ''

  // Delete existing transactions for this unit/tenant/month
  const { error: deleteTxnError } = await supabaseClient
    .from('transactions')
    .delete()
    .eq('unit_id', uid)
    .eq('source', 'ledger')
    .gte('date', `${yr}-${String(mo + 1).padStart(2, '0')}-01`)
    .lt('date', `${yr}-${String(mo + 2).padStart(2, '0')}-01`)

  if (deleteTxnError) {
    console.error('savePay delete transactions error:', deleteTxnError)
    toast('Failed to update transactions', true)
    return
  }

  // Check if payment record exists
  const { data: existingPay, error: checkError } = await supabaseClient
    .from('payments')
    .select('id')
    .eq('unit_id', uid)
    .eq('tenant_id', tid)
    .eq('year', yr)
    .eq('month', mo)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('savePay check error:', checkError)
    toast('Failed to check payment', true)
    return
  }

  // Insert or update payment record
  if (existingPay) {
    // Update
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        rent,
        previous_balance: prev,
        late_fee: late,
        other,
        gas,
        electricity: elec,
        water,
        inspection: insp,
        total,
        received,
        remaining,
        payment_date: date,
        payment_mode: mode,
        status,
        notes
      })
      .eq('unit_id', uid)
      .eq('tenant_id', tid)
      .eq('year', yr)
      .eq('month', mo)

    if (updateError) {
      console.error('savePay update error:', updateError)
      toast('Payment update failed', true)
      return
    }
  } else {
    // Insert
    const { error: insertError } = await supabaseClient
      .from('payments')
      .insert([
        {
          unit_id: uid,
          tenant_id: tid,
          year: yr,
          month: mo,
          rent,
          previous_balance: prev,
          late_fee: late,
          other,
          gas,
          electricity: elec,
          water,
          inspection: insp,
          total,
          received,
          remaining,
          payment_date: date,
          payment_mode: mode,
          status,
          notes
        }
      ])

    if (insertError) {
      console.error('savePay insert error:', insertError)
      toast('Payment save failed', true)
      return
    }
  }

  // Create transaction records
  const txnsToInsert = []

  if (received > 0) {
    txnsToInsert.push({
      source: 'ledger',
      property: propId,
      unit_id: uid,
      type: 'income',
      date,
      amount: received,
      category: 'Rent',
      vendor: '',
      description: `${tenantName} — ${MO_F[mo]} ${yr} (${mode})`
    })
  }

  if (late > 0) {
    txnsToInsert.push({
      source: 'ledger',
      property: propId,
      unit_id: uid,
      type: 'income',
      date,
      amount: late,
      category: 'Late Fee',
      vendor: '',
      description: `${tenantName} — late fee ${MO_F[mo]} ${yr}`
    })
  }

  if (insp > 0) {
    txnsToInsert.push({
      source: 'ledger',
      property: propId,
      unit_id: uid,
      type: 'expense',
      date,
      amount: insp,
      category: 'Annual Inspection Fee',
      vendor: '',
      description: `Inspection fee — ${unitName}`
    })
  }

  if (txnsToInsert.length > 0) {
    const { error: txnError } = await supabaseClient
      .from('transactions')
      .insert(txnsToInsert)

    if (txnError) {
      console.error('savePay insert transactions error:', txnError)
      toast('Payment saved but transaction post failed', true)
    }
  }

  closeOv('pay')
  toast('Payment saved & transactions updated ✓')
  await loadPayments()
  await loadTransactions()
  renderAll()
}

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, err) {
  const t = document.getElementById('toast-el');
  t.textContent = msg; t.style.borderLeftColor = err ? 'var(--rd)' : 'var(--gn)';
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800);
}

async function loadProperties() {
  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')

  if (error) {
    console.error('loadProperties error:', error)
    return
  }

  DB.props = data || []
}

async function loadUnits() {
  const { data, error } = await supabaseClient
    .from('units')
    .select(`
      id,
      prop_id,
      name,
      start_date,
      end_date,
      due,
      late_fee_day,
      late_fee_amt,
      tenants (
        id,
        unit_id,
        name,
        share
      )
    `)

  if (error) {
    console.error('loadUnits error:', error)
    return
  }

  DB.units = (data || []).map(u => ({
    id: u.id,
    propId: u.prop_id,
    name: u.name,
    start: u.start_date,
    end: u.end_date,
    due: u.due,
    lateFeeDay: u.late_fee_day,
    lateFeeAmt: u.late_fee_amt,
    tenants: (u.tenants || []).map(t => ({
      id: t.id,
      name: t.name,
      share: t.share
    }))
  }))
}

async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  if (error) {
    console.error('loadTransactions error:', error)
    return
  }

  DB.txns = (data || []).map(t => ({
    id: t.id,
    type: t.type,
    date: t.date,
    amount: t.amount,
    property: t.property,
    unitId: t.unit_id,
    unitName: '',
    category: t.category,
    vendor: t.vendor || '',
    desc: t.description || '—',
    source: t.source || 'manual'
  }))
}

async function loadViolations() {
  const { data, error } = await supabaseClient
    .from('violations')
    .select('*')

  if (error) {
    console.error('loadViolations error:', error)
    return
  }

  DB.viols = (data || []).map(v => ({
    id: v.id,
    propId: v.prop_id,
    type: v.type,
    date: v.date,
    amount: v.amount,
    code: v.code || '',
    status: v.status || 'open',
    notes: v.notes || ''
  }))
}

async function loadPayments() {
  const { data, error } = await supabaseClient
    .from('payments')
    .select('*')

  if (error) {
    console.error('loadPayments error:', error)
    return
  }

  DB.pays = {}
  ;(data || []).forEach(p => {
    const key = pkey(p.unit_id, p.tenant_id, p.year, p.month)
    DB.pays[key] = {
      rent: p.rent,
      prev: p.previous_balance,
      late: p.late_fee,
      other: p.other || 0,
      gas: p.gas || 0,
      elec: p.electricity || 0,
      water: p.water || 0,
      insp: p.inspection || 0,
      total: p.total,
      received: p.received,
      remaining: p.remaining,
      date: p.payment_date,
      mode: p.payment_mode,
      status: p.status,
      notes: p.notes || ''
    }
  })
}

// ── RENDER ─────────────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  if (curView === 'dashboard') renderDash();
  if (curView === 'properties') renderProps();
  if (curView === 'rentledger') renderLedger();
  if (curView === 'transactions') renderTxns();
  if (curView === 'cashflow') renderCF();
  if (curView === 'violations') renderViols();
  if (curView === 'taxreport') renderTax();
}

function renderSidebar() {
  document.getElementById('sb-props').innerHTML = DB.props.map((p, i) =>
    `<div class="pp" onclick="setView('properties')"><div class="dot" style="background:${COLS[i % COLS.length]}"></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span></div>`).join('');
}

function txnTable(list) {
  if (!list.length) return `<div class="empty"><div style="font-size:28px;margin-bottom:8px">↕</div>No transactions yet</div>`;
  return `<div style="overflow-x:auto"><table>
    <thead><tr><th>Date</th><th>Property</th><th>Unit</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Src</th><th>Edit</th><th>Del</th></tr></thead>
    <tbody>${list.map(t => {
    const p = getProp(t.property); 
    const i = DB.props.findIndex(pr => pr.id === t.property);
    const unit = t.unitId ? DB.units.find(u => u.id === t.unitId) : null;
    const unitName = unit ? unit.name : '—';
    const isLedger = t.source === 'ledger';
    return `<tr>
        <td class="mono" style="color:var(--tx3);white-space:nowrap">${t.date}</td>
        <td><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:${COLS[Math.max(i, 0) % COLS.length]}"></div><span style="font-size:12px;white-space:nowrap">${p ? p.name : '—'}</span></div></td>
        <td style="font-size:11px;color:var(--tx2)">${unitName}</td>
        <td><span class="badge ${t.type === 'income' ? 'bg2' : 'br2'}">${t.category}</span></td>
        <td style="color:var(--tx2);font-size:12px">${t.vendor || '—'}</td>
        <td style="color:var(--tx2);font-size:12px">${t.desc}</td>
        <td class="mono ${t.type === 'income' ? 'tg' : 'tr'}" style="white-space:nowrap">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</td>
        <td><span class="badge ${isLedger ? 'bb2' : 'bgr'}" style="font-size:10px">${isLedger ? 'Ledger' : 'Manual'}</span></td>
        <td>${!isLedger ? `<button class="edbtn" onclick="openTxnModal(${t.id})">Edit</button>` : '<span style="color:var(--tx3);font-size:11px">—</span>'}</td>
        <td><span style="cursor:pointer;color:var(--tx3);font-size:18px" onclick="delTxn(${t.id})">×</span></td>
      </tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderDash() {
  const yr = getYr(); const list = yrTxns(yr);
  const inc = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = inc - exp;
  const now = new Date(); const cy = now.getFullYear(), cm = now.getMonth();
  let od = 0;
  DB.units.forEach(u => u.tenants.forEach(t => { const s = getPay(u.id, t.id, cy, cm); if (!s || s.status === 'overdue') od++; }));
  document.getElementById('od-alert').innerHTML = od > 0 && DB.units.length > 0
    ? `<div class="alert aw">⚠ ${od} payment(s) pending or overdue for ${MO_F[cm]}. <span style="cursor:pointer;text-decoration:underline" onclick="setView('rentledger')">View Rent Ledger →</span></div>` : '';
  document.getElementById('sg').innerHTML = `
    <div class="sc sci"><div class="sl">Total Income</div><div class="sv tg">${fmt(inc)}</div><div class="sd">${yr} · all properties</div></div>
    <div class="sc sce"><div class="sl">Total Expenses</div><div class="sv tr">${fmt(exp)}</div><div class="sd">All categories</div></div>
    <div class="sc scn"><div class="sl">Net Operating Income</div><div class="sv" style="color:var(--ac);font-size:20px">${net < 0 ? '-' : ''}${fmt(net)}</div><div class="sd">Before depreciation</div></div>
    <div class="sc scu"><div class="sl">Units / Properties</div><div class="sv" style="color:var(--ac2)">${DB.units.length} / ${DB.props.length}</div></div>`;
  const bp = DB.props.map((p, i) => { const pt = list.filter(t => t.property === p.id); const pi = pt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0); const pe = pt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); return { p, pi, pe, n: pi - pe, i }; });
  document.getElementById('inc-tbl').innerHTML = bp.length
    ? `<table><thead><tr><th>Property</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>${bp.map(r => `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="dot" style="background:${COLS[r.i % COLS.length]}"></div>${r.p.name}</div></td><td class="mono tg">${fmt(r.pi)}</td><td class="mono tr">${fmt(r.pe)}</td><td class="mono ${r.n >= 0 ? 'tg' : 'tr'}">${r.n >= 0 ? '+' : '-'}${fmt(r.n)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">No properties yet</div>`;
  const bc = {}; list.filter(t => t.type === 'expense').forEach(t => { bc[t.category] = (bc[t.category] || 0) + t.amount; });
  const cats = Object.entries(bc).sort((a, b) => b[1] - a[1]);
  document.getElementById('exp-tbl').innerHTML = cats.length
    ? `<table><thead><tr><th>Category</th><th>Amount</th><th>%</th></tr></thead><tbody>${cats.map(([c, a]) => `<tr><td>${c}</td><td class="mono tr">${fmt(a)}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="pb" style="width:60px"><div class="pf" style="width:${Math.round(a / (exp || 1) * 100)}%;background:var(--rd)"></div></div><span style="font-size:11px;color:var(--tx3)">${Math.round(a / (exp || 1) * 100)}%</span></div></td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">No expenses yet</div>`;
  document.getElementById('rec-tbl').innerHTML = txnTable(DB.txns.slice(0, 10));
}

function renderProps() {
  if (!DB.props.length) {
    document.getElementById('props-content').innerHTML = `<div class="empty"><div style="font-size:30px;margin-bottom:8px">🏠</div>No properties yet — click "+ Property" to add one.</div>`;
    return;
  }
  let html = '';
  DB.props.forEach((p, pi) => {
    const propUnits = DB.units.filter(u => u.propId === p.id);
    html += `<div class="prop-card">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div class="dot" style="background:${COLS[pi % COLS.length]};width:11px;height:11px"></div>
          <div class="prop-card-name">${p.name}</div>
        </div>
        <div class="prop-card-meta">
          ${p.address ? p.address + ', ' : ''} ${p.city || ''}<br>
          Purchase Price: <strong>${fmt(p.price)}</strong> &nbsp;·&nbsp; Est. Monthly Rent: <strong>${fmt(p.rent)}</strong><br>
          Rent Due: Day <strong>${p.due}</strong> &nbsp;·&nbsp; Late Fee After Day <strong>${p.lateFeeDay}</strong>${p.lateFee > 0 ? ' — ' + fmt(p.lateFee) : ''}
        </div>
        <div class="act-row">
          <button class="bg bsm" onclick="openPropModal(${p.id})">✎ Edit Property</button>
          <button class="bg bsm" onclick="openUnitModal(null); document.getElementById('u-prop').value=${p.id}">+ Add Unit</button>
          <button class="bdanger" onclick="deleteProp(${p.id})">Delete</button>
        </div>
      </div>
      <div class="badge bgr" style="font-size:12px;white-space:nowrap">${propUnits.length} unit${propUnits.length !== 1 ? 's' : ''}</div>
    </div>
    ${propUnits.length ? propUnits.map(u => {
      const expired = u.end && new Date(u.end) < new Date();
      const vacant = !u.tenants.length;
      return `<div style="margin-left:20px;margin-bottom:10px;background:var(--sf);border:1px solid var(--bd);border-left:3px solid ${COLS[pi % COLS.length]};border-radius:var(--r);padding:14px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <div style="font-weight:600;font-size:14px">${u.name}
              ${vacant ? '<span class="badge bgr" style="font-size:10px;margin-left:6px">Vacant</span>' : ''}
              ${expired ? '<span class="badge br2" style="font-size:10px;margin-left:6px">Expired</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--tx3);margin-top:4px">
              Lease: ${u.start || '—'} → ${u.end || 'Open'} &nbsp;·&nbsp; Due day ${u.due} &nbsp;·&nbsp; Late fee after day ${u.lateFeeDay || 8}${u.lateFeeAmt > 0 ? ' (' + fmt(u.lateFeeAmt) + ')' : ''}
            </div>
            ${u.tenants.length ? `<div style="margin-top:8px">${u.tenants.map(t => `
              <div style="display:flex;align-items:center;gap:10px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--bd)">
                <span style="color:var(--tx)">👤 ${t.name}</span>
                <span class="mono" style="color:var(--ac)">${fmt(t.share)}/mo</span>
              </div>`).join('')}</div>` : '<div style="font-size:12px;color:var(--tx3);margin-top:6px">No tenants assigned yet.</div>'}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <button class="bg bsm" onclick="openUnitModal(${u.id})">✎ Edit Unit</button>
            <button class="bdanger" onclick="deleteUnit(${u.id})">Delete</button>
          </div>
        </div>
      </div>`;
    }).join('') : '<div style="margin-left:20px;margin-bottom:12px;font-size:12px;color:var(--tx3)">No units for this property. <span style="cursor:pointer;color:var(--ac)" onclick="openUnitModal(null)">+ Add a unit</span></div>'}`;
  });
  document.getElementById('props-content').innerHTML = html;
}

function renderLedger() {
  const mSel = document.getElementById('l-mo'), ySel = document.getElementById('l-yr');
  if (!mSel.children.length) {
    mSel.innerHTML = MO_F.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    const cy = new Date().getFullYear();
    ySel.innerHTML = [cy + 1, cy, cy - 1, cy - 2].map(y => `<option value="${y}">${y}</option>`).join('');
    mSel.value = new Date().getMonth(); ySel.value = cy;
    mSel.onchange = ySel.onchange = renderLedger;
  }
  const mo = parseInt(mSel.value), yr = parseInt(ySel.value), isFeb = (mo === 1);
  let totDue = 0, totCol = 0, totBal = 0;
  DB.units.forEach(u => u.tenants.forEach(t => { const s = getPay(u.id, t.id, yr, mo); totDue += s ? s.total : t.share; totCol += s ? s.received : 0; totBal += s ? s.remaining : 0; }));
  let html = `<div class="g3">
    <div class="sc sci"><div class="sl">Total Due</div><div class="sv tg" style="font-size:20px">${fmt(totDue)}</div></div>
    <div class="sc scn"><div class="sl">Collected</div><div class="sv" style="color:var(--ac);font-size:20px">${fmt(totCol)}</div></div>
    <div class="sc sce"><div class="sl">Outstanding</div><div class="sv tr" style="font-size:20px">${fmt(totBal)}</div></div>
  </div>`;
  if (isFeb) html += `<div class="alert aw">🔍 Annual inspection fees are typically due in February.</div>`;
  if (!DB.units.length) html += `<div class="empty"><div style="font-size:28px;margin-bottom:8px">◫</div>No units yet — click "+ Unit" to add one.</div>`;
  DB.props.forEach((prop, pi) => {
    const pu = DB.units.filter(u => u.propId === prop.id); if (!pu.length) return;
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div class="dot" style="background:${COLS[pi % COLS.length]};width:9px;height:9px"></div>
      <span style="font-family:'DM Serif Display',serif;font-size:15px">${prop.name}</span>
      <span style="color:var(--tx3);font-size:11px">${prop.address}${prop.city ? ', ' + prop.city : ''}</span>
    </div>`;
    pu.forEach(unit => {
      const exp = unit.end && new Date(unit.end) < new Date();
      const vacant = !unit.tenants.length;
      html += `<div class="uc">
        <div class="uh">
          <div>
            <div class="un">${unit.name}
              <span style="color:var(--tx3);font-size:12px;font-weight:400"> · ${vacant ? 'Vacant' : unit.tenants.length + ' tenant' + (unit.tenants.length > 1 ? ' (split)' : '')}</span>
              ${exp ? '<span class="badge br2" style="font-size:10px;margin-left:6px">Expired</span>' : ''}
              ${vacant ? '<span class="badge bgr" style="font-size:10px;margin-left:6px">Vacant</span>' : ''}
            </div>
            <div class="um">Due day ${unit.due} · Late fee after day ${unit.lateFeeDay || 8}${unit.lateFeeAmt > 0 ? ' — ' + fmt(unit.lateFeeAmt) : ''} · Lease: ${unit.start || '—'} → ${unit.end || 'Open'}</div>
          </div>
          <button class="bg bsm" onclick="openUnitModal(${unit.id})">✎ Edit Unit</button>
        </div>
        ${vacant
        ? `<div style="padding:16px 18px;color:var(--tx3);font-size:13px">No tenants assigned — <span style="cursor:pointer;color:var(--ac);text-decoration:underline" onclick="openUnitModal(${unit.id})">edit unit to add tenants</span>.</div>`
        : `<div class="lw"><table class="lt">
            <thead><tr><th>Tenant</th><th>Rent</th><th>Prev.Bal</th><th>Late Fee</th><th>Gas</th><th>Electricity</th><th>Water</th><th>Insp.Fee</th><th>Total Due</th><th>Received</th><th>Balance</th><th>Mode</th><th>Date Paid</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${unit.tenants.map(t => {
          const s = getPay(unit.id, t.id, yr, mo);
          const SM = { paid: ['bg2', 'Paid'], partial: ['by2', 'Partial'], late: ['bb2', 'Late'], overdue: ['br2', 'Overdue'] };
          const [cls, lbl] = s ? (SM[s.status] || ['bgr', '?']) : ['bgr', 'Pending'];
          return `<tr>
                <td><strong>${t.name}</strong></td>
                <td class="mono" style="color:var(--ac)">${s ? fmt(s.rent) : fmt(t.share)}</td>
                <td class="mono ${s && s.prev > 0 ? 'ty' : ''}">${s && s.prev > 0 ? fmt(s.prev) : '—'}</td>
                <td class="mono ${s && s.late > 0 ? 'tr' : ''}">${s && s.late > 0 ? fmt(s.late) : '—'}</td>
                <td class="mono">${s && s.gas > 0 ? fmt(s.gas) : '—'}</td>
                <td class="mono">${s && s.elec > 0 ? fmt(s.elec) : '—'}</td>
                <td class="mono">${s && s.water > 0 ? fmt(s.water) : '—'}</td>
                <td class="mono">${s && s.insp > 0 ? fmt(s.insp) : '—'}</td>
                <td class="mono tr">${s ? fmt(s.total) : '—'}</td>
                <td class="mono tg">${s ? fmt(s.received) : '—'}</td>
                <td class="mono ${s && s.remaining > 0 ? 'tr' : 'tg'}">${s ? fmt(s.remaining) : '—'}</td>
                <td style="font-size:11px;color:var(--tx2)">${s ? s.mode : '—'}</td>
                <td style="font-size:11px;color:var(--tx3)">${s ? s.date : '—'}</td>
                <td><span class="badge ${cls}">${lbl}</span></td>
                <td><button class="bg bsm" onclick="openPayModal(${unit.id},${t.id},${yr},${mo})">${s ? 'Edit' : 'Record'}</button></td>
              </tr>`;
        }).join('')}</tbody>
          </table></div>`}
      </div>`;
    });
  });
  document.getElementById('ledger').innerHTML = html;
}

function renderTxns() {
  const yr = getYr(); let list = yrTxns(yr);
  if (txnFilter === 'income') list = list.filter(t => t.type === 'income');
  if (txnFilter === 'expense') list = list.filter(t => t.type === 'expense');
  document.getElementById('all-txns').innerHTML = txnTable(list);
}

function renderCF() {
  const yr = getYr(); const list = yrTxns(yr);
  const monthly = MO.map((m, mi) => { const mt = list.filter(t => new Date(t.date).getMonth() === mi); const i = mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0); const e = mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); return { m, i, e, net: i - e }; });
  const mx = Math.max(...monthly.map(m => Math.max(m.i, m.e)), 1);
  document.getElementById('cf').innerHTML = `
    <div style="background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:20px;margin-bottom:18px">
      <div style="font-family:'DM Serif Display',serif;font-size:16px;margin-bottom:12px">Monthly Cash Flow — ${yr}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px"><span style="font-size:11px;color:var(--gn)">■ Income</span><span style="font-size:11px;color:var(--rd)">■ Expenses</span></div>
      <div class="cbars">${monthly.map(m => `<div style="flex:1;display:flex;gap:2px;align-items:flex-end;height:80px"><div class="cbar" style="background:var(--gn);opacity:.85;height:${Math.round(m.i / mx * 100)}%"></div><div class="cbar" style="background:var(--rd);opacity:.85;height:${Math.round(m.e / mx * 100)}%"></div></div>`).join('')}</div>
      <div class="clabels">${monthly.map(m => `<div class="clabel">${m.m}</div>`).join('')}</div>
    </div>
    <div class="tc"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>
    ${monthly.map(m => `<tr><td>${m.m} ${yr}</td><td class="mono tg">${fmt(m.i)}</td><td class="mono tr">${fmt(m.e)}</td><td class="mono ${m.net >= 0 ? 'tg' : 'tr'}">${m.net >= 0 ? '+' : '-'}${fmt(m.net)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function renderViols() {
  const bT = { violation: DB.viols.filter(v => v.type === 'violation'), inspection: DB.viols.filter(v => v.type === 'inspection'), misc: DB.viols.filter(v => v.type === 'misc') };
  const openV = DB.viols.filter(v => v.type === 'violation' && v.status === 'open');
  const tF = DB.viols.filter(v => v.type === 'violation').reduce((s, v) => s + v.amount, 0);
  const tI = DB.viols.filter(v => v.type === 'inspection').reduce((s, v) => s + v.amount, 0);
  let html = `<div class="g3">
    <div class="sc sce"><div class="sl">Open Violations</div><div class="sv tr" style="font-size:22px">${openV.length}</div></div>
    <div class="sc scn"><div class="sl">Total Fines</div><div class="sv" style="color:var(--ac);font-size:20px">${fmt(tF)}</div></div>
    <div class="sc scu"><div class="sl">Inspection Fees</div><div class="sv" style="color:var(--ac2);font-size:20px">${fmt(tI)}</div></div>
  </div>`;
  const TL = { violation: '⚠ Code Violations', inspection: '🔍 Annual Inspections', misc: '📋 Misc Expenses' };
  const TC = { violation: 'var(--rd)', inspection: 'var(--ac2)', misc: 'var(--ac)' };
  ['violation', 'inspection', 'misc'].forEach(type => {
    const items = bT[type]; if (!items.length) return;
    html += `<div style="margin-bottom:18px"><div style="font-family:'DM Serif Display',serif;font-size:15px;color:${TC[type]};margin-bottom:10px">${TL[type]}</div>
    ${items.map(v => {
      const p = getProp(v.propId); const pi = DB.props.findIndex(pr => pr.id === v.propId); const res = v.status === 'resolved';
      return `<div class="vc ${res ? 'res' : ''}">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div class="dot" style="background:${COLS[Math.max(pi, 0) % COLS.length]}"></div><strong>${p ? p.name : '—'}</strong>${v.code ? ` <span class="badge bgr">${v.code}</span>` : ''}<span class="badge ${res ? 'bg2' : v.status === 'contested' ? 'by2' : 'br2'}">${v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span></div>
          <div style="font-size:12px;color:var(--tx2);margin-bottom:3px">${v.notes || 'No notes'}</div>
          <div style="font-size:11px;color:var(--tx3)">Date: ${v.date} · <span class="mono tr">${fmt(v.amount)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <button class="bg bsm" onclick="openViolModal(${v.id})">✎ Edit</button>
          ${type === 'violation' ? `<button class="bg bsm" onclick="toggleVS(${v.id})">${res ? 'Reopen' : 'Resolve'}</button>` : ''}
          <button class="bdanger" onclick="deleteViol(${v.id})">Delete</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  });
  if (!DB.viols.length) html += `<div class="empty"><div style="font-size:28px;margin-bottom:8px">✓</div>No violations logged yet.</div>`;
  document.getElementById('viols').innerHTML = html;
}

function renderTax() {
  const yr = getYr(); const list = yrTxns(yr);
  let html = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
    <div><div style="font-family:'DM Serif Display',serif;font-size:20px">Schedule E Summary — ${yr}</div>
    <div style="color:var(--tx3);font-size:12px;margin-top:3px">Supplemental Income and Loss · Part I: Rental Real Estate</div></div>
    <button class="btn" onclick="window.print()">Print</button>
  </div><div class="alert aw">⚠ Fines are generally <strong>not deductible</strong>. Depreciation is estimated. Consult a CPA before filing.</div>`;
  let gI = 0, gE = 0, gD = 0;
  DB.props.forEach((p, pi) => {
    const pt = list.filter(t => t.property === p.id);
    const inc = pt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const bc = {}; pt.filter(t => t.type === 'expense').forEach(t => { bc[t.category] = (bc[t.category] || 0) + t.amount; });
    const exp = Object.values(bc).reduce((s, v) => s + v, 0);
    const dep = Math.round(p.price * 0.0364); const net = inc - exp - dep;
    gI += inc; gE += exp; gD += dep;
    html += `<div style="margin-bottom:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px"><div class="dot" style="background:${COLS[pi % COLS.length]};width:9px;height:9px"></div><div style="font-family:'DM Serif Display',serif;font-size:16px">${p.name}</div><div style="color:var(--tx3);font-size:12px">${p.address}${p.city ? ', ' + p.city : ''}</div></div>
        <button class="bg bsm" onclick="openPropModal(${p.id})">✎ Edit</button>
      </div>
      <div style="background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:18px">
        <div class="sr"><span class="slb">Rents received <span class="sln">Line 3</span></span><span class="mono tg">${fmt(inc)}</span></div>
        ${Object.entries(bc).map(([cat, amt]) => `<div class="sr"><span class="slb">${cat} <span class="sln">${SCHED_E[cat] || 'Line 19'}</span></span><span class="mono tr">${fmt(amt)}</span></div>`).join('')}
        <div class="sr"><span class="slb">Depreciation <span class="sln">Line 18 — 27.5-yr straight-line (est.)</span></span><span class="mono tr">${fmt(dep)}</span></div>
        <div class="sr tot"><span>Net Rental Income / (Loss)</span><span class="mono" style="font-size:16px;color:${net >= 0 ? 'var(--gn)' : 'var(--rd)'}">${net < 0 ? '-' : ''}${fmt(net)}</span></div>
      </div></div>`;
  });
  if (!DB.props.length) html += `<div class="empty">No properties yet.</div>`;
  if (DB.props.length > 1) { const gN = gI - gE - gD; html += `<div style="background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);padding:20px"><div style="font-family:'DM Serif Display',serif;font-size:16px;margin-bottom:14px">Combined Summary</div><div class="sr"><span>Total Gross Rents</span><span class="mono tg">${fmt(gI)}</span></div><div class="sr"><span>Total Expenses</span><span class="mono tr">${fmt(gE)}</span></div><div class="sr"><span>Total Depreciation (est.)</span><span class="mono tr">${fmt(gD)}</span></div><div class="sr tot"><span>Net Taxable Income / (Loss)</span><span class="mono" style="font-size:18px;color:${gN >= 0 ? 'var(--gn)' : 'var(--rd)'}">${gN < 0 ? '-' : ''}${fmt(gN)}</span></div><div style="margin-top:14px;padding:12px;background:rgba(200,169,110,.07);border-radius:8px;font-size:12px;color:var(--tx3);line-height:1.7">For planning purposes only. Consult a licensed CPA before filing.</div></div>`; }
  document.getElementById('tax').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadProperties()
  await loadUnits()
  await loadTransactions()
  await loadViolations()
  await loadPayments()
  renderAll()
});
