// ===================================================================
// orders.js — Orders page (Underway / Completed / Cancelled)
// ===================================================================

let allOrders = [];
let currentFilter = 'ALL';

window.addEventListener('DOMContentLoaded', async () => {
  const user = initUserSession();
  if (!user) return;

  await refreshOrders();
});

async function refreshOrders() {
  try {
    if (!DEMO_MODE) {
      allOrders = await OrderAPI.getOrdersRemote();
    } else {
      allOrders = OrderAPI.getOrders();
    }

    updateCounts(allOrders);
    renderOrders();
  } catch (err) {
    const body = document.getElementById('ordersBody');
    if (body) {
      body.innerHTML = `<tr><td colspan="9" class="text-center text-red" style="padding:30px;">${err.message || 'Failed to load orders'}</td></tr>`;
    }
  }
}

function updateCounts(orders) {
  const pending = orders.filter(o => o.status === 'PENDING').length;
  const filled = orders.filter(o => o.status === 'FILLED').length;
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length;

  setText('countPending', pending);
  setText('countFilled', filled);
  setText('countCancelled', cancelled);
}

function setOrderFilter(filter) {
  currentFilter = filter;

  ['all', 'pending', 'filled', 'cancelled'].forEach(k => {
    const el = document.getElementById('tab-' + k);
    if (el) el.classList.remove('active');
  });

  const map = { ALL: 'all', PENDING: 'pending', FILLED: 'filled', CANCELLED: 'cancelled' };
  const active = document.getElementById('tab-' + map[filter]);
  if (active) active.classList.add('active');

  renderOrders();
}

function renderOrders() {
  const body = document.getElementById('ordersBody');
  if (!body) return;

  let list = allOrders;
  if (currentFilter !== 'ALL') {
    list = allOrders.filter(o => o.status === currentFilter);
  }

  if (list.length === 0) {
    body.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:30px;">No orders in this section</td></tr>';
    return;
  }

  body.innerHTML = list.map(o => {
    const statusClass = o.status === 'PENDING' ? 'pill-pending' : (o.status === 'CANCELLED' ? 'pill-cancelled' : 'pill-filled');
    const total = (o.total ?? (o.price * o.shares)).toFixed(2);
    const canCancel = !DEMO_MODE && o.status === 'PENDING' && o._id;

    return `
      <tr>
        <td><span class="pill ${statusClass}">${o.status}</span></td>
        <td><span class="order-badge ${(o.type || '').toLowerCase()}">${o.type || '-'}</span></td>
        <td class="font-mono font-bold">${o.symbol || '-'}</td>
        <td class="text-muted">${(o.orderType || 'market').toUpperCase()}</td>
        <td class="font-mono">${o.shares ?? '-'}</td>
        <td class="font-mono">$${Number(o.price || 0).toFixed(2)}</td>
        <td class="font-mono font-semibold">$${total}</td>
        <td class="text-muted" style="font-size:0.8rem;">${formatDate(o.timestamp || o.createdAt)}</td>
        <td>
          ${canCancel ? `<div class="table-actions"><button class="btn btn-sm btn-ghost" onclick="cancelOrder('${o._id}')">Cancel</button></div>` : '<span class="text-muted text-xs">—</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

async function cancelOrder(orderId) {
  try {
    await OrderAPI.cancelOrderRemote(orderId);
    showToast('Order cancelled successfully', 'success');
    await refreshOrders();
  } catch (err) {
    showToast(err.message || 'Failed to cancel order', 'error');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}
