// index.js — Firebase Synced MBBS Financial Records

import { db, ref, set, onValue } from "./firebase.js";

// storage key
const storageKey = "paymentLists_v3";

// helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const uid = (n = 8) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + n);
const numberWithCommas = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// state
let state = { lists: [], activeListId: null };
const userPath = "users/demoUser/state"; // 👈 change "demoUser" later if you add authentication

// DOM refs
const listsEl = $("#lists");
const summaryEl = $("#summary");
const feeTitleDisplay = $("#feeTitleDisplay");
const feeAmountDisplay = $("#feeAmountDisplay");
const listDate = $("#listDate");

const btnNew = $("#btnNew");
const btnPrintGlobal = $("#btnPrintGlobal");
const btnExportJSON = $("#btnExportJSON");
const btnImportJSON = $("#btnImportJSON");
const btnPrintList = $("#btnPrintList");
const btnExportTXCSV = $("#btnExportTXCSV");

const txForm = $("#txForm");
const txType = $("#txType");
const txAmount = $("#txAmount");
const txCategory = $("#txCategory");
const txDate = $("#txDate");
const txDesc = $("#txDesc");
const btnAddTx = $("#btnAddTx");

const txFilterType = $("#txFilterType");
const txFilterFrom = $("#txFilterFrom");
const txFilterTo = $("#txFilterTo");
const btnApplyTxFilter = $("#btnApplyTxFilter");
const btnClearTxFilter = $("#btnClearTxFilter");

const txTbody = $("#txTbody");

const totalIncomeEl = $("#totalIncome");
const totalExpensesEl = $("#totalExpenses");
const netBalanceEl = $("#netBalance");

const globalTotalIncome = $("#globalTotalIncome");
const globalTotalExpenses = $("#globalTotalExpenses");
const globalNetBalance = $("#globalNetBalance");

// 🔄 Load + Sync with Firebase
function load() {
  // Load from localStorage
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    state = { lists: [], activeListId: null };
  }

  // Sync from Firebase (live listener)
  onValue(ref(db, userPath), (snapshot) => {
    const cloudData = snapshot.val();
    if (cloudData) {
      state = cloudData;
      localStorage.setItem(storageKey, JSON.stringify(state));
      render();
    }
  });
}

// Save to both localStorage + Firebase
function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  set(ref(db, userPath), state);
  render();
}

// utils
function getActiveList() {
  return state.lists.find((l) => l.id === state.activeListId) || null;
}

function createList(title = "New Fee") {
  const id = "L_" + uid(6);
  const list = {
    id,
    title,
    createdAt: new Date().toISOString(),
    txs: [],
  };
  state.lists.unshift(list);
  state.activeListId = id;
  save();
}

function addTransactionToActive({ type, amount, category, date, desc }) {
  const list = getActiveList();
  if (!list) return false;
  const amt = Number(amount) || 0;
  if (amt <= 0) return false;
  const tx = {
    id: "T_" + uid(6),
    type: type === "expense" ? "expense" : "income",
    amount: amt,
    category: category || "",
    date: date || new Date().toISOString().slice(0, 10),
    desc: desc || "",
  };
  list.txs.unshift(tx);
  save();
  return true;
}

function deleteTx(id) {
  const list = getActiveList();
  if (!list) return;
  list.txs = list.txs.filter((t) => t.id !== id);
  save();
}

// NEW: Delete a fee list itself
function deleteList(id) {
  if (!confirm("Delete this entire fee list?")) return;
  state.lists = state.lists.filter((l) => l.id !== id);
  if (state.activeListId === id)
    state.activeListId = state.lists[0]?.id || null;
  save();
}

// calculations
function calcTotals(list) {
  const income = (list.txs || [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = (list.txs || [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  return { income, expense, net: income - expense };
}

function calcGlobalTotals() {
  let income = 0,
    expense = 0;
  state.lists.forEach((l) => {
    const t = calcTotals(l);
    income += t.income;
    expense += t.expense;
  });
  return { income, expense, net: income - expense };
}

// rendering
function renderLists() {
  listsEl.innerHTML = "";
  if (!state.lists.length) {
    listsEl.innerHTML =
      '<div class="small">No lists yet — click New List to begin.</div>';
    summaryEl.textContent = "No lists saved";
    return;
  }
  state.lists.forEach((l) => {
    const totals = calcTotals(l);
    const div = document.createElement("div");
    div.className =
      "list-item" + (l.id === state.activeListId ? " active" : "");
    div.dataset.id = l.id;
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(l.title)}</strong>
        <div class="small">${new Date(l.createdAt).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="small">₦${numberWithCommas(totals.net)}</div>
        <button class="btn ghost btn-del-list" style="color:red;border:none;font-weight:bold;">🗑️</button>
      </div>
    `;
    div.querySelector(".btn-del-list").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteList(l.id);
    });
    div.addEventListener("click", () => {
      state.activeListId = l.id;
      save();
    });
    listsEl.appendChild(div);
  });

  summaryEl.textContent = `${state.lists.length} list(s) saved`;
}

function renderActive() {
  const active = getActiveList();
  if (!active) {
    feeTitleDisplay.textContent = "No active list";
    feeAmountDisplay.textContent = "Create a list to begin";
    listDate.textContent = "";
    txTbody.innerHTML = "";
    totalIncomeEl.textContent = "₦0";
    totalExpensesEl.textContent = "₦0";
    netBalanceEl.textContent = "₦0";
    return;
  }

  feeTitleDisplay.textContent = active.title;
  feeAmountDisplay.textContent = `Transactions: ${active.txs.length}`;
  listDate.textContent =
    "Created: " + new Date(active.createdAt).toLocaleString();

  const filterType = txFilterType?.value || "all";
  const from = txFilterFrom?.value || "";
  const to = txFilterTo?.value || "";

  let txs = active.txs || [];
  if (filterType !== "all") txs = txs.filter((t) => t.type === filterType);
  if (from) txs = txs.filter((t) => t.date >= from);
  if (to) txs = txs.filter((t) => t.date <= to);

  if (!txs.length) {
    txTbody.innerHTML = `<tr><td colspan="6" class="muted-small center">No transactions</td></tr>`;
  } else {
    txTbody.innerHTML = "";
    txs.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.type === "income" ? "Income" : "Expense"}</td>
        <td>₦${numberWithCommas(t.amount)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td>${escapeHtml(t.desc)}</td>
        <td><button class="btn ghost" style="color:red" data-id="${
          t.id
        }">🗑️</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => {
        deleteTx(t.id);
      });
      txTbody.appendChild(tr);
    });
  }

  const totals = calcTotals(active);
  totalIncomeEl.textContent = "₦" + numberWithCommas(totals.income);
  totalExpensesEl.textContent = "₦" + numberWithCommas(totals.expense);
  netBalanceEl.textContent = "₦" + numberWithCommas(totals.net);
  netBalanceEl.style.color =
    totals.net >= 0 ? "var(--success)" : "var(--danger)";
}

function renderGlobalSummary() {
  const g = calcGlobalTotals();
  globalTotalIncome.textContent = "₦" + numberWithCommas(g.income);
  globalTotalExpenses.textContent = "₦" + numberWithCommas(g.expense);
  globalNetBalance.textContent = "₦" + numberWithCommas(g.net);
  globalNetBalance.style.color =
    g.net >= 0 ? "var(--success)" : "var(--danger)";
}

function render() {
  renderLists();
  renderActive();
  renderGlobalSummary();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}

// init
load();
render();

// events
btnNew.addEventListener("click", () => {
  const title = prompt("Create new fee list (title):");
  if (!title) return;
  createList(title);
});

btnAddTx.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) return alert("Create a fee list first.");

  const type = txType.value;
  const amount = Number(txAmount.value);
  const category = txCategory.value.trim();
  const date = txDate.value || new Date().toISOString().slice(0, 10);
  const desc = txDesc.value.trim();

  if (!amount || isNaN(amount) || amount <= 0)
    return alert("Enter a valid amount.");

  addTransactionToActive({ type, amount, category, date, desc });
  txAmount.value = txCategory.value = txDate.value = txDesc.value = "";
});

btnApplyTxFilter.addEventListener("click", render);
btnClearTxFilter.addEventListener("click", () => {
  txFilterType.value = "all";
  txFilterFrom.value = "";
  txFilterTo.value = "";
  render();
});
// ----------------------------------------------
// 🖨️ PRINT & EXPORT FEATURES
// ----------------------------------------------

// Print the active list
btnPrintList.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) return alert("No active list to print.");

  const totals = calcTotals(list);
  const html = `
    <h2>${escapeHtml(list.title)}</h2>
    <p><strong>Created:</strong> ${new Date(
      list.createdAt
    ).toLocaleString()}</p>
    <p><strong>Total Income:</strong> ₦${numberWithCommas(totals.income)}</p>
    <p><strong>Total Expenses:</strong> ₦${numberWithCommas(totals.expense)}</p>
    <p><strong>Net Balance:</strong> ₦${numberWithCommas(totals.net)}</p>
    <hr>
    <h3>Transactions</h3>
    <ul>
      ${list.txs
        .map(
          (t) => `
        <li>
          <strong>${
            t.type === "income" ? "Income" : "Expense"
          }</strong> — ₦${numberWithCommas(t.amount)} 
          (${escapeHtml(t.category)}${t.desc ? ": " + escapeHtml(t.desc) : ""})
          <em> [${t.date}]</em>
        </li>
      `
        )
        .join("")}
    </ul>
  `;
  const win = window.open("", "_blank");
  win.document.write(
    `<html><head><title>${list.title}</title></head><body>${html}</body></html>`
  );
  win.document.close();
  win.print();
});

// Print the global summary
btnPrintGlobal.addEventListener("click", () => {
  const g = calcGlobalTotals();

  const html = `
    <h2>Global Summary</h2>
    <p><strong>Total Income:</strong> ₦${numberWithCommas(g.income)}</p>
    <p><strong>Total Expenses:</strong> ₦${numberWithCommas(g.expense)}</p>
    <p><strong>Net Balance:</strong> ₦${numberWithCommas(g.net)}</p>
    <hr>
    <h3>All Fee Lists</h3>
    <ul>
      ${state.lists
        .map((l) => {
          const t = calcTotals(l);
          return `
          <li>
            <strong>${escapeHtml(l.title)}</strong><br>
            Income: ₦${numberWithCommas(t.income)} |
            Expenses: ₦${numberWithCommas(t.expense)} |
            Net: ₦${numberWithCommas(t.net)}
          </li>`;
        })
        .join("")}
    </ul>
  `;
  const win = window.open("", "_blank");
  win.document.write(
    `<html><head><title>Global Summary</title></head><body>${html}</body></html>`
  );
  win.document.close();
  win.print();
});
// Export all data as JSON
btnExportJSON.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mbbs-financial-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

// Import JSON backup
btnImportJSON.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.lists) {
          state = data;
          save();
          alert("Import successful!");
        } else {
          alert("Invalid file format.");
        }
      } catch {
        alert("Error reading file.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
});
