// ===================================================================
// auth.js — Auth guard & user session management
// ===================================================================

function requireAuth() {
  const token = localStorage.getItem('token');
  const user  = localStorage.getItem('user');
  if (!token || !user) {
    window.location.href = 'index.html';
    return null;
  }
  return JSON.parse(user);
}

function getCurrentUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function showComingSoon(event, feature) {
  event.preventDefault();
  showToast(`${feature} — Coming soon! 🚧`, 'info');
}

// Initialize user session on page load
function initUserSession() {
  const user = requireAuth();
  if (!user) return null;

  // Set avatar initials across all elements
  const initials = getInitials(user.name);
  document.querySelectorAll('.user-avatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('#sidebarAvatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('#topbarAvatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('#sidebarName').forEach(el => el.textContent = user.name);

  // Set balance
  updateBalanceDisplay(user.balance);

  return user;
}

function updateBalanceDisplay(balance) {
  // Balance is always stored in USD — always show $ regardless of active market
  const formatted = '$' + (typeof balance === 'number' ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '10,000.00');
  document.querySelectorAll('#topbarBalance').forEach(el => el.textContent = formatted);
  document.querySelectorAll('#orderBalance').forEach(el => el.textContent = formatted);
  document.querySelectorAll('#statCash').forEach(el => el.textContent = formatted);
}
