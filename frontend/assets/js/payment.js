// ===================================================================
// payment.js — Payment page logic (mock Stripe-like flow)
// ===================================================================

let currentPayTab = 'deposit';
let selectedAmount = 0;

window.addEventListener('DOMContentLoaded', () => {
  const user = initUserSession();
  if (!user) return;

  updatePayBalances();
  loadTransactions();
});

async function updatePayBalances() {
  const user = getCurrentUser();
  if (!user) return;
  const bal = '$' + (user.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  setEl('payBalance', bal);
  setEl('withdrawAvailable', bal);

  // Portfolio value estimate
  let holdings = JSON.parse(localStorage.getItem('portfolio') || '[]');
  if (!DEMO_MODE) {
    try {
      holdings = await PortfolioAPI.getHoldings();
    } catch (_) {}
  }
  let portVal = user.balance || 0;
  // Quick estimate (no async here)
  holdings.forEach(h => {
    const stock = DEMO_STOCKS.find(s => s.symbol === h.symbol);
    portVal += (stock ? stock.price : h.avgPrice) * h.shares;
  });
  setEl('payPortfolioValue', '$' + portVal.toFixed(2));
}

// ===== TAB SWITCH =====
function switchPayTab(tab) {
  currentPayTab = tab;
  const depositForm   = document.getElementById('depositForm');
  const withdrawForm  = document.getElementById('withdrawForm');
  const depositTabBtn = document.getElementById('depositTabBtn');
  const withdrawTabBtn= document.getElementById('withdrawTabBtn');

  if (tab === 'deposit') {
    depositForm.style.display   = '';
    withdrawForm.style.display  = 'none';
    depositTabBtn.classList.add('active');
    withdrawTabBtn.classList.remove('active');
  } else {
    depositForm.style.display   = 'none';
    withdrawForm.style.display  = '';
    depositTabBtn.classList.remove('active');
    withdrawTabBtn.classList.add('active');
    updatePayBalances();
  }
}

// ===== AMOUNT SELECTION =====
function setAmount(amount) {
  selectedAmount = amount;
  document.getElementById('depositAmount').value = amount;
  document.querySelectorAll('#quickAmounts .amount-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.textContent.replace(/[^0-9]/g,'')) === amount);
  });
}
function clearAmountBtns() {
  document.querySelectorAll('#quickAmounts .amount-btn').forEach(b => b.classList.remove('active'));
}

function setWithdrawAmount(amount) {
  document.getElementById('withdrawAmount').value = amount;
}
function selectAllFunds() {
  const user = getCurrentUser();
  if (user) document.getElementById('withdrawAmount').value = (user.balance || 0).toFixed(2);
}

// ===== CARD FORMATTING =====
function formatCardNumber(input) {
  let value = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = value.replace(/(.{4})/g, '$1 ').trim();

  // Detect card type
  const cardTypeEl = document.getElementById('cardType');
  if (!cardTypeEl) return;
  if      (/^4/.test(value))  cardTypeEl.textContent = '💙 Visa';
  else if (/^5[1-5]/.test(value)) cardTypeEl.textContent = '🔴 MC';
  else if (/^3[47]/.test(value))  cardTypeEl.textContent = '🟢 Amex';
  else if (/^6/.test(value))  cardTypeEl.textContent = '🟠 Disc.';
  else cardTypeEl.textContent = '';
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2);
  input.value = v;
}

// ===== VALIDATE CARD =====
function validateCard() {
  const number = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const name   = document.getElementById('cardName').value.trim();
  const expiry = document.getElementById('cardExpiry').value;
  const cvv    = document.getElementById('cardCvv').value;

  if (number.length < 13) throw new Error('Please enter a valid card number');
  if (!name)              throw new Error('Please enter cardholder name');
  if (expiry.length < 5)  throw new Error('Please enter a valid expiry date');
  if (cvv.length < 3)     throw new Error('Please enter CVV');

  return { cardNumber: number, cardName: name, expiry, cvv };
}

// ===== HANDLE DEPOSIT =====
async function handleDeposit() {
  const errEl  = document.getElementById('depositError');
  errEl.textContent = '';

  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!amount || amount < 10) { errEl.textContent = 'Minimum deposit is $10.'; return; }
  if (amount > 100000) { errEl.textContent = 'Maximum single deposit is $100,000.'; return; }

  let cardDetails;
  try { cardDetails = validateCard(); }
  catch (err) { errEl.textContent = err.message; return; }

  // Show processing
  show('depositProcessing');
  hide('depositMain');
  setEl('depositBtn', '');

  try {
    const tx = await PaymentAPI.deposit(amount, cardDetails);

    hide('depositProcessing');
    show('depositSuccess');
    setEl('depositSuccessMsg', `$${amount.toFixed(2)} has been added to your account! 🎉`);
    setEl('payBalance', '$' + getCurrentUser().balance.toFixed(2));
    updatePayBalances();
    loadTransactions();
    showToast(`Deposited $${amount.toFixed(2)} successfully!`, 'success');

  } catch (err) {
    hide('depositProcessing');
    show('depositMain');
    errEl.textContent = err.message;
  }
}

function resetDepositForm() {
  hide('depositSuccess');
  show('depositMain');
  document.getElementById('depositAmount').value = '';
  document.getElementById('cardNumber').value = '';
  document.getElementById('cardName').value = '';
  document.getElementById('cardExpiry').value = '';
  document.getElementById('cardCvv').value = '';
  document.getElementById('cardType').textContent = '';
  document.querySelectorAll('#quickAmounts .amount-btn').forEach(b => b.classList.remove('active'));
  selectedAmount = 0;
}

// ===== HANDLE WITHDRAW =====
async function handleWithdraw() {
  const errEl  = document.getElementById('withdrawError');
  errEl.textContent = '';

  const amount  = parseFloat(document.getElementById('withdrawAmount').value);
  const bankLast4 = document.getElementById('bankLast4').value.trim();

  const user = getCurrentUser();
  if (!amount || amount < 10) { errEl.textContent = 'Minimum withdrawal is $10.'; return; }
  if (amount > (user.balance || 0)) { errEl.textContent = `Insufficient balance. Available: $${user.balance.toFixed(2)}`; return; }
  if (bankLast4.length !== 4 || !/^\d{4}$/.test(bankLast4)) { errEl.textContent = 'Please enter valid last 4 digits of bank account.'; return; }

  show('withdrawProcessing');
  hide('withdrawMain');

  try {
    await PaymentAPI.withdraw(amount);

    hide('withdrawProcessing');
    show('withdrawSuccess');
    setEl('withdrawSuccessMsg', `$${amount.toFixed(2)} will arrive to ****${bankLast4} in 1–3 business days.`);
    updatePayBalances();
    loadTransactions();
    showToast(`Withdrawal of $${amount.toFixed(2)} initiated!`, 'success');

  } catch (err) {
    hide('withdrawProcessing');
    show('withdrawMain');
    errEl.textContent = err.message;
  }
}

function resetWithdrawForm() {
  hide('withdrawSuccess');
  show('withdrawMain');
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('bankLast4').value = '';
    updatePayBalances();
}

// ===== TRANSACTION HISTORY =====
async function loadTransactions() {
  const container = document.getElementById('txHistory');
  let txs = PaymentAPI.getTransactions();
  if (!DEMO_MODE) {
    try {
      txs = await PaymentAPI.getTransactionsRemote();
    } catch (_) {}
  }

  if (txs.length === 0) {
    container.innerHTML = '<div class="text-center text-muted text-sm" style="padding:30px 0;">No transactions yet</div>';
    return;
  }

  container.innerHTML = txs.map(tx => {
    const isDeposit = tx.type === 'DEPOSIT';
    return `
      <div class="tx-item">
        <div class="tx-icon ${isDeposit ? 'deposit' : 'withdraw'}">
          ${isDeposit ? '⬇️' : '⬆️'}
        </div>
        <div class="tx-details">
          <div class="tx-type">${isDeposit ? 'Deposit' : 'Withdrawal'}</div>
          <div class="tx-date">${formatDate(tx.timestamp)} ${tx.last4 ? '· ****' + tx.last4 : ''}</div>
        </div>
        <div class="tx-amount ${isDeposit ? 'price-up' : 'price-down'}">
          ${isDeposit ? '+' : '-'}$${tx.amount.toFixed(2)}
        </div>
      </div>
    `;
  }).join('');
}

// ===== HELPERS =====
function show(id) { const el = document.getElementById(id); if(el) el.classList.add('show'); }
function hide(id) { const el = document.getElementById(id); if(el) el.classList.remove('show'); }
function setEl(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }

// Expose DEMO_STOCKS for quick portfolio value estimate
const DEMO_STOCKS = [
  { symbol: 'AAPL', price: 189.45 }, { symbol: 'TSLA', price: 248.72 },
  { symbol: 'NVDA', price: 912.30 }, { symbol: 'MSFT', price: 415.18 },
  { symbol: 'GOOGL', price: 174.50 }, { symbol: 'AMZN', price: 193.25 },
  { symbol: 'META', price: 513.80 }, { symbol: 'NFLX', price: 635.40 },
  { symbol: 'AMD',  price: 178.60 }, { symbol: 'DIS',  price: 112.45 },
];
