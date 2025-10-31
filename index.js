// index.js - simplified: no Names UI (only transactions + global summary)
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

// load/save
function load() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load state", e);
    state = { lists: [], activeListId: null };
  }
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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
    title: title || "New Fee",
    createdAt: new Date().toISOString(),
    txs: [], // {id,type,amount,category,date,desc}
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
    div.innerHTML = `<div><strong>${escapeHtml(
      l.title
    )}</strong><div class="small">${new Date(
      l.createdAt
    ).toLocaleDateString()}</div></div><div class="small">₦${numberWithCommas(
      totals.net
    )}</div>`;
    div.addEventListener("click", () => {
      state.activeListId = l.id;
      save();
    });
    listsEl.appendChild(div);
  });

  const totalNames = state.lists.length;
  summaryEl.textContent = `${state.lists.length} list(s) • ${state.lists.length} saved`;
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

  // transactions table
  const filterType = txFilterType?.value || "all";
  const from = txFilterFrom?.value || "";
  const to = txFilterTo?.value || "";

  let txs = active.txs || [];
  if (filterType && filterType !== "all")
    txs = txs.filter((t) => t.type === filterType);
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
        <td>
          <div class="row-actions">
            <button class="btn ghost btn-delete-tx" data-id="${
              t.id
            }">Delete</button>
          </div>
        </td>
      `;
      tr.querySelector(".btn-delete-tx").addEventListener("click", () => {
        if (confirm("Delete this transaction?")) deleteTx(t.id);
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

// helpers
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function (m) {
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
btnNew.addEventListener("click", async () => {
  const title = prompt("Create new fee list (title):");
  if (!title) return;
  createList(title);
});

btnAddTx.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) {
    alert("Create a fee list first.");
    return;
  }
  const type = txType.value;
  const amount = Number(txAmount.value);
  const category = txCategory.value.trim();
  const date = txDate.value || new Date().toISOString().slice(0, 10);
  const desc = txDesc.value.trim();

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Enter a valid amount.");
    return;
  }

  const ok = addTransactionToActive({ type, amount, category, date, desc });
  if (!ok) {
    alert("Failed to add transaction.");
    return;
  }

  // clear form
  txAmount.value = "";
  txCategory.value = "";
  txDate.value = "";
  txDesc.value = "";
});

btnApplyTxFilter.addEventListener("click", render);
btnClearTxFilter.addEventListener("click", () => {
  txFilterType.value = "all";
  txFilterFrom.value = "";
  txFilterTo.value = "";
  render();
});

// export/import JSON
btnExportJSON.addEventListener("click", () => {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mbbs_financial_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

btnImportJSON.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.lists))
          throw new Error("Invalid format");
        state = obj;
        // normalize minimal structure
        state.lists = state.lists.map((l) => ({
          id: l.id || "L_" + uid(6),
          title: l.title || "Imported Fee",
          createdAt: l.createdAt || new Date().toISOString(),
          txs: Array.isArray(l.txs)
            ? l.txs.map((t) => ({
                id: t.id || "T_" + uid(6),
                type: t.type === "expense" ? "expense" : "income",
                amount: Number(t.amount) || 0,
                category: t.category || "",
                date: t.date || new Date().toISOString().slice(0, 10),
                desc: t.desc || "",
              }))
            : [],
        }));
        if (!state.activeListId && state.lists.length)
          state.activeListId = state.lists[0].id;
        save();
        alert("Import successful");
      } catch (err) {
        alert("Failed to import JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// export transactions CSV for active list
btnExportTXCSV.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) {
    alert("No active list");
    return;
  }
  const rows = [["Date", "Type", "Amount", "Category", "Description"]];
  (list.txs || []).forEach((t) =>
    rows.push([t.date, t.type, t.amount, t.category, t.desc])
  );
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(list.title || "transactions").replace(/\s+/g, "_")}_tx.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// print active list
btnPrintList.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) {
    alert("No active list");
    return;
  }
  const totals = calcTotals(list);

  const incomeTxs = (list.txs || []).filter((t) => t.type === "income");
  const expenseTxs = (list.txs || []).filter((t) => t.type === "expense");

  const headerHtml = `<h2>100L MBBS Financial Records</h2>
    <div style="color:#6b7280;margin-bottom:8px">List: ${escapeHtml(
      list.title
    )}</div>
    <div style="color:#6b7280;margin-bottom:8px">Generated: ${new Date().toLocaleString()}</div>`;

  let bodyHtml = `<div style="margin-top:12px">`;
  bodyHtml += `<div style="margin-bottom:10px"><strong>Total Income:</strong> ₦${numberWithCommas(
    totals.income
  )}</div>`;
  bodyHtml += `<div style="margin-bottom:10px"><strong>Income sources:</strong><ul>`;
  if (incomeTxs.length) {
    incomeTxs.forEach((t) => {
      bodyHtml += `<li>${escapeHtml(
        t.category || t.desc || "Income"
      )} — ₦${numberWithCommas(t.amount)}</li>`;
    });
  } else {
    bodyHtml += `<li>—</li>`;
  }
  bodyHtml += `</ul></div>`;

  bodyHtml += `<div style="margin-bottom:10px"><strong>Total Expenses:</strong> ₦${numberWithCommas(
    totals.expense
  )}</div>`;
  bodyHtml += `<div style="margin-bottom:10px"><strong>Expenditures:</strong><ul>`;
  if (expenseTxs.length) {
    expenseTxs.forEach((t) => {
      bodyHtml += `<li>${escapeHtml(
        t.category || t.desc || "Expense"
      )} — ₦${numberWithCommas(t.amount)}</li>`;
    });
  } else {
    bodyHtml += `<li>—</li>`;
  }
  bodyHtml += `</ul></div>`;

  bodyHtml += `<div style="margin-top:14px"><strong>Net Balance:</strong> ₦${numberWithCommas(
    totals.net
  )}</div>`;
  bodyHtml += `</div>`;

  const win = window.open("", "_blank", "width=900,height=700");
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(
    list.title
  )}</title>
    <style>body{font-family:Inter,Arial;padding:24px;color:#111}h2{margin:0 0 6px 0}ul{margin:6px 0 12px 18px}</style></head><body>${headerHtml}${bodyHtml}<script>window.print()</script></body></html>`);
  win.document.close();
});

// print global summary (detailed)
btnPrintGlobal.addEventListener("click", () => {
  const headerHtml = `<h2>100L MBBS Financial Records</h2>
    <div style="color:#6b7280;margin-bottom:8px">Generated: ${new Date().toLocaleString()}</div>`;

  let bodyHtml = "";

  state.lists.forEach((list) => {
    const totals = calcTotals(list);
    const incomeTxs = (list.txs || []).filter((t) => t.type === "income");
    const expenseTxs = (list.txs || []).filter((t) => t.type === "expense");

    bodyHtml += `<section style="margin-bottom:20px;padding:12px;border:1px solid #eee;border-radius:8px">
      <h3 style="margin:0 0 6px 0;color:#2563eb">${escapeHtml(list.title)}</h3>
      <div style="margin-bottom:8px"><strong>Total Income:</strong> ₦${numberWithCommas(
        totals.income
      )}</div>
      <div style="margin-bottom:8px"><strong>Income sources:</strong>
        <ul>`;
    if (incomeTxs.length) {
      incomeTxs.forEach((t) => {
        bodyHtml += `<li>${escapeHtml(
          t.category || t.desc || "Income"
        )} — ₦${numberWithCommas(t.amount)}</li>`;
      });
    } else {
      bodyHtml += `<li>—</li>`;
    }
    bodyHtml += `</ul></div>`;

    bodyHtml += `<div style="margin-bottom:8px"><strong>Total Expenses:</strong> ₦${numberWithCommas(
      totals.expense
    )}</div>
      <div style="margin-bottom:8px"><strong>Expenditures:</strong>
        <ul>`;
    if (expenseTxs.length) {
      expenseTxs.forEach((t) => {
        bodyHtml += `<li>${escapeHtml(
          t.category || t.desc || "Expense"
        )} — ₦${numberWithCommas(t.amount)}</li>`;
      });
    } else {
      bodyHtml += `<li>—</li>`;
    }
    bodyHtml += `</ul></div>`;

    bodyHtml += `<div style="margin-top:6px"><strong>Net Balance:</strong> ₦${numberWithCommas(
      totals.net
    )}</div>`;
    bodyHtml += `</section>`;
  });

  // overall totals
  const global = calcGlobalTotals();
  bodyHtml += `<section style="margin-top:8px;padding:12px;border-top:2px solid #eee">
    <h3 style="margin:0 0 6px 0">Overall Totals</h3>
    <div><strong>Total Income:</strong> ₦${numberWithCommas(
      global.income
    )}</div>
    <div><strong>Total Expenses:</strong> ₦${numberWithCommas(
      global.expense
    )}</div>
    <div style="margin-top:6px"><strong>Net Balance:</strong> ₦${numberWithCommas(
      global.net
    )}</div>
  </section>`;

  const win = window.open("", "_blank", "width=1000,height=800");
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"/><title>Global Summary</title>
    <style>body{font-family:Inter,Arial;padding:24px;color:#111}h2{margin:0 0 6px 0}section{background:#fff}</style></head><body>${headerHtml}${bodyHtml}<script>window.print()</script></body></html>`);
  win.document.close();
});
