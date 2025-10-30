// index.js - full app for "100L MBBS Financial Records"
// Saves everything in localStorage under key 'paymentLists_v2'

/* ---------- helpers ---------- */
const storageKey = "paymentLists_v2";
const uid = (n = 8) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + n);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const numberWithCommas = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/* ---------- state ---------- */
let lists = []; // array of lists
let activeListId = null;

/* ---------- DOM refs ---------- */
const listsEl = $("#lists");
const summaryEl = $("#summary");
const feeTitleDisplay = $("#feeTitleDisplay");
const feeAmountDisplay = $("#feeAmountDisplay");
const listDate = $("#listDate");
const nameInput = $("#nameInput");
const namesTbody = $("#namesTbody");

const btnAddName = $("#btnAddName");
const btnNew = $("#btnNew");
const btnDeleteList = $("#btnDeleteList");
const btnDuplicate = $("#btnDuplicate");
const btnPrint = $("#btnPrint");
const printSelect = $("#printSelect");

const btnExportJSON = $("#btnExportJSON");
const btnImportJSON = $("#btnImportJSON");
const btnExportCSV = $("#btnExportCSV");

const btnClearNotPaid = $("#btnClearNotPaid");

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

/* modal */
const modalBackdrop = $("#modalBackdrop");
const modalTitle = $("#modalTitle");
const modalDesc = $("#modalDesc");
const modalBody = $("#modalBody");
const modalCancel = $("#modalCancel");
const modalConfirm = $("#modalConfirm");

/* ---------- GLOBAL SUMMARY ---------- */
const globalSummaryEl = document.createElement("div");
globalSummaryEl.className = "card small-card";
globalSummaryEl.style.marginBottom = "12px";
globalSummaryEl.innerHTML = `
  <div class="card-title">Global Summary</div>
  <div>Total Lists: <span id="globalTotalLists">0</span></div>
  <div>Total Names: <span id="globalTotalNames">0</span></div>
  <div>Total Income: ₦<span id="globalTotalIncome">0</span></div>
  <div>Total Expenses: ₦<span id="globalTotalExpenses">0</span></div>
  <div>Net Balance: ₦<span id="globalNetBalance">0</span></div>
  <button class="btn primary" id="btnPrintGlobal">Print Global</button>
`;
document.querySelector(".summary-cards").prepend(globalSummaryEl);

const globalTotalLists = document.getElementById("globalTotalLists");
const globalTotalNames = document.getElementById("globalTotalNames");
const globalTotalIncome = document.getElementById("globalTotalIncome");
const globalTotalExpenses = document.getElementById("globalTotalExpenses");
const globalNetBalance = document.getElementById("globalNetBalance");
const btnPrintGlobal = document.getElementById("btnPrintGlobal");

function renderGlobalSummary() {
  const totalLists = lists.length;
  const totalNames = lists.reduce((s, l) => s + l.names.length, 0);

  // Calculate income as total amount (paid names × fee amount)
  const totalIncome = lists.reduce((s, l) => {
    const paidCount = l.names.filter((n) => n.status === "paid").length;
    return s + paidCount * l.amount;
  }, 0);

  const totalExpenses = lists.reduce(
    (s, l) =>
      s +
      (l.txs || [])
        .filter((t) => t.type === "expense")
        .reduce((ss, t) => ss + Number(t.amount), 0),
    0
  );
  const net = totalIncome - totalExpenses;

  globalTotalLists.textContent = totalLists;
  globalTotalNames.textContent = totalNames;
  globalTotalIncome.textContent = numberWithCommas(totalIncome);
  globalTotalExpenses.textContent = numberWithCommas(totalExpenses);
  globalNetBalance.textContent = numberWithCommas(net);
}

/* ---------- modal helper ---------- */
let modalResolve = null;

function showModal({
  title = "",
  desc = "",
  bodyHTML = "",
  confirmText = "OK",
  cancelText = "Cancel",
} = {}) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalBody.innerHTML = bodyHTML || "";
  modalConfirm.textContent = confirmText;
  modalCancel.textContent = cancelText;
  modalBackdrop.hidden = false;

  return new Promise((resolve) => {
    modalResolve = resolve;

    function cleanup() {
      modalBackdrop.hidden = true;
      modalConfirm.onclick = null;
      modalCancel.onclick = null;
      document.onkeydown = null;
    }

    function onConfirm() {
      cleanup();
      resolve({ confirmed: true });
    }

    function onCancel() {
      cleanup();
      resolve({ confirmed: false });
    }

    function onKeydown(e) {
      if (e.key === "Escape") onCancel();
    }

    modalConfirm.onclick = onConfirm;
    modalCancel.onclick = onCancel;
    document.onkeydown = onKeydown;
  });
}

/* ---------- storage ---------- */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      lists = Array.isArray(parsed) ? parsed : parsed.lists || [];
      if (lists.length) activeListId = lists[0].id;
    } else {
      lists = [];
      activeListId = null;
    }
  } catch (e) {
    console.error("Failed to load storage", e);
    lists = [];
    activeListId = null;
  }
}

function saveToStorage() {
  localStorage.setItem(storageKey, JSON.stringify(lists));
  renderLists();
}

/* ---------- list operations ---------- */
function createList({ title = "New Fee", amount = 0, copyFromId = null } = {}) {
  const newList = {
    id: "L_" + uid(6),
    title: title || "New Fee",
    amount: Number(amount) || 0,
    createdAt: new Date().toISOString(),
    names: [], // {id, name, status}
    txs: [], // transactions {id,type,amount,category,date,desc}
  };

  if (copyFromId) {
    const src = lists.find((l) => l.id === copyFromId);
    if (src) {
      newList.names = src.names.map((n) => ({
        id: "N_" + uid(6),
        name: n.name,
        status: "not_paid",
      }));
    }
  }

  lists.unshift(newList);
  activeListId = newList.id;
  saveToStorage();
  render();
}

function duplicateList(id) {
  const src = lists.find((l) => l.id === id);
  if (!src) return;
  const copy = {
    id: "L_" + uid(6),
    title: src.title + " (copy)",
    amount: src.amount,
    createdAt: new Date().toISOString(),
    names: src.names.map((n) => ({
      id: "N_" + uid(6),
      name: n.name,
      status: n.status,
    })),
    txs: src.txs.map((t) => ({ ...t, id: "T_" + uid(6) })),
  };
  lists.unshift(copy);
  activeListId = copy.id;
  saveToStorage();
  render();
}

function deleteList(id) {
  const idx = lists.findIndex((l) => l.id === id);
  if (idx === -1) return;
  lists.splice(idx, 1);
  if (lists.length) activeListId = lists[0].id;
  else activeListId = null;
  saveToStorage();
  render();
}

function getActiveList() {
  return lists.find((l) => l.id === activeListId) || null;
}

/* ---------- names operations ---------- */
function addNameToActive(nameText) {
  const list = getActiveList();
  if (!list) {
    alert("Please create a list first");
    return false;
  }
  const trimmed = (nameText || "").trim();
  if (!trimmed) return false;
  list.names.push({ id: "N_" + uid(6), name: trimmed, status: "not_paid" });
  saveToStorage();
  render();
  return true;
}

function toggleStatus(listId, nameId) {
  const l = lists.find((x) => x.id === listId);
  if (!l) return;
  const n = l.names.find((x) => x.id === nameId);
  if (!n) return;
  n.status = n.status === "paid" ? "not_paid" : "paid";
  saveToStorage();
  render();
}

function editName(listId, nameId) {
  const l = lists.find((x) => x.id === listId);
  if (!l) return;
  const n = l.names.find((x) => x.id === nameId);
  if (!n) return;
  showModal({
    title: "Edit name",
    desc: "Correct or update the name.",
    bodyHTML: `<input id="modalEditInput" class="input" value="${escapeHtml(
      n.name
    )}" />`,
    confirmText: "Save",
    cancelText: "Cancel",
  }).then((res) => {
    if (res.confirmed) {
      const input = document.getElementById("modalEditInput");
      if (input) {
        const val = input.value.trim();
        if (val) {
          n.name = val;
          saveToStorage();
          render();
        }
      }
    }
  });
}

function deleteName(listId, nameId) {
  const l = lists.find((x) => x.id === listId);
  if (!l) return;
  const idx = l.names.findIndex((x) => x.id === nameId);
  if (idx === -1) return;
  showModal({
    title: "Delete name",
    desc: "Are you sure you want to remove this person?",
    bodyHTML: `<div class="small">This action cannot be undone.</div>`,
    confirmText: "Delete",
    cancelText: "Cancel",
  }).then((res) => {
    if (res.confirmed) {
      l.names.splice(idx, 1);
      saveToStorage();
      render();
    }
  });
}

function clearNotPaid() {
  const list = getActiveList();
  if (!list) return;
  showModal({
    title: "Clear Not Paid",
    desc: "This will remove every person whose status is Not Paid from the active list.",
    bodyHTML: `<div class="small">Are you sure?</div>`,
    confirmText: "Yes, clear",
    cancelText: "Cancel",
  }).then((res) => {
    if (res.confirmed) {
      list.names = list.names.filter((n) => n.status === "paid");
      saveToStorage();
      render();
    }
  });
}

/* ---------- transactions ---------- */
function addTransaction({
  type = "income",
  amount = 0,
  category = "",
  date = null,
  desc = "",
}) {
  const list = getActiveList();
  if (!list) {
    alert("Please create a list first");
    return false;
  }
  const amt = Number(amount) || 0;
  if (amt <= 0) {
    alert("Please enter a valid amount");
    return false;
  }
  const tx = {
    id: "T_" + uid(6),
    type: type === "expense" ? "expense" : "income",
    amount: amt,
    category: category || "",
    date: date || new Date().toISOString().slice(0, 10),
    desc: desc || "",
  };
  list.txs.unshift(tx);
  saveToStorage();
  render();
  return true;
}

function editTx(txId) {
  const list = getActiveList();
  if (!list) return;
  const t = list.txs.find((x) => x.id === txId);
  if (!t) return;
  showModal({
    title: "Edit transaction",
    desc: "Make changes then save.",
    bodyHTML: `<div style="display:flex;flex-direction:column;gap:8px">
      <select id="modalTxType" class="input">
        <option value="income" ${
          t.type === "income" ? "selected" : ""
        }>Income</option>
        <option value="expense" ${
          t.type === "expense" ? "selected" : ""
        }>Expense</option>
      </select>
      <input id="modalTxAmount" class="input" value="${t.amount}" />
      <input id="modalTxCategory" class="input" value="${escapeHtml(
        t.category
      )}" />
      <input id="modalTxDate" class="input" type="date" value="${t.date}" />
      <input id="modalTxDesc" class="input" value="${escapeHtml(t.desc)}" />
    </div>`,
    confirmText: "Save",
    cancelText: "Cancel",
  }).then((res) => {
    if (!res.confirmed) return;
    const mt = document.getElementById("modalTxType").value;
    const ma = Number(document.getElementById("modalTxAmount").value) || 0;
    const mc = document.getElementById("modalTxCategory").value.trim();
    const md =
      document.getElementById("modalTxDate").value ||
      new Date().toISOString().slice(0, 10);
    const mdesc = document.getElementById("modalTxDesc").value.trim();
    t.type = mt;
    t.amount = ma;
    t.category = mc;
    t.date = md;
    t.desc = mdesc;
    saveToStorage();
    render();
  });
}

function deleteTx(txId) {
  const list = getActiveList();
  if (!list) return;
  const idx = list.txs.findIndex((x) => x.id === txId);
  if (idx === -1) return;
  showModal({
    title: "Delete transaction",
    desc: "Remove this transaction permanently.",
    bodyHTML: `<div class="small">Are you sure?</div>`,
    confirmText: "Delete",
    cancelText: "Cancel",
  }).then((res) => {
    if (res.confirmed) {
      list.txs.splice(idx, 1);
      saveToStorage();
      render();
    }
  });
}

/* ---------- rendering ---------- */
function renderLists() {
  listsEl.innerHTML = "";
  if (!lists.length) {
    listsEl.innerHTML =
      '<div class="small">No lists yet — click New List to begin.</div>';
    summaryEl.textContent = "No lists saved";
    return;
  }
  lists.forEach((l) => {
    const div = document.createElement("div");
    div.className = "list-item" + (l.id === activeListId ? " active" : "");
    div.dataset.id = l.id;
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(l.title)}</strong>
        <div class="small">${l.names.length} names • ₦${numberWithCommas(
      l.amount
    )}</div>
      </div>
      <div class="small">${new Date(l.createdAt).toLocaleDateString()}</div>
    `;
    div.addEventListener("click", () => {
      activeListId = l.id;
      render();
    });
    listsEl.appendChild(div);
  });

  const totalNames = lists.reduce((s, li) => s + li.names.length, 0);
  summaryEl.textContent = `${lists.length} list(s) • ${totalNames} total name(s)`;
}

function renderMainInfo() {
  const active = getActiveList();
  if (!active) {
    feeTitleDisplay.textContent = "No active list";
    feeAmountDisplay.textContent = "Create a list to begin";
    listDate.textContent = "";
    namesTbody.innerHTML = "";
    txTbody.innerHTML = "";
    totalIncomeEl.textContent = "₦0";
    totalExpensesEl.textContent = "₦0";
    netBalanceEl.textContent = "₦0";
    return;
  }
  feeTitleDisplay.textContent = active.title;
  feeAmountDisplay.textContent = "₦" + numberWithCommas(active.amount);
  listDate.textContent =
    "Created: " + new Date(active.createdAt).toLocaleString();

  // names
  if (!active.names.length) {
    namesTbody.innerHTML = `<tr><td colspan="5" class="muted-small center">No names yet — add names to build the list.</td></tr>`;
  } else {
    namesTbody.innerHTML = "";
    active.names.forEach((n) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(n.name)}</td>
        <td>${escapeHtml(active.title)}</td>
        <td>₦${numberWithCommas(active.amount)}</td>
        <td>
          <span class="status-pill ${
            n.status === "paid" ? "paid" : "not-paid"
          }" data-id="${n.id}">
            ${n.status === "paid" ? "Paid" : "Not Paid"}
          </span>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn ghost btn-edit" data-id="${n.id}">Edit</button>
            <button class="btn ghost btn-delete" data-id="${
              n.id
            }">Delete</button>
          </div>
        </td>
      `;
      tr.querySelector(".status-pill").addEventListener("click", () =>
        toggleStatus(active.id, n.id)
      );
      tr.querySelector(".btn-edit").addEventListener("click", () =>
        editName(active.id, n.id)
      );
      tr.querySelector(".btn-delete").addEventListener("click", () =>
        deleteName(active.id, n.id)
      );
      namesTbody.appendChild(tr);
    });
  }

  // Calculate income as total amount (paid names × fee amount)
  const paidCount = active.names.filter((n) => n.status === "paid").length;
  const income = paidCount * active.amount;

  const expense = (active.txs || [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  totalIncomeEl.textContent = "₦" + numberWithCommas(income);
  totalExpensesEl.textContent = "₦" + numberWithCommas(expense);
  netBalanceEl.textContent = "₦" + numberWithCommas(income - expense);

  renderTxTable();
}

function renderTxTable() {
  const active = getActiveList();
  if (!active) {
    txTbody.innerHTML = "";
    return;
  }
  const filterType = txFilterType.value;
  const from = txFilterFrom.value;
  const to = txFilterTo.value;
  let txs = active.txs || [];
  if (filterType && filterType !== "all")
    txs = txs.filter((t) => t.type === filterType);
  if (from) txs = txs.filter((t) => t.date >= from);
  if (to) txs = txs.filter((t) => t.date <= to);
  if (!txs.length) {
    txTbody.innerHTML = `<tr><td colspan="6" class="muted-small center">No transactions</td></tr>`;
    return;
  }
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
          <button class="btn ghost btn-edit-tx" data-id="${t.id}">Edit</button>
          <button class="btn ghost btn-delete-tx" data-id="${
            t.id
          }">Delete</button>
        </div>
      </td>
    `;
    tr.querySelector(".btn-edit-tx").addEventListener("click", () =>
      editTx(t.id)
    );
    tr.querySelector(".btn-delete-tx").addEventListener("click", () =>
      deleteTx(t.id)
    );
    txTbody.appendChild(tr);
  });
}

function render() {
  renderLists();
  renderMainInfo();
  renderGlobalSummary();
}

/* ---------- init & events ---------- */
function init() {
  loadFromStorage();
  render();

  // Add name handlers
  btnAddName.addEventListener("click", () => {
    const ok = addNameToActive(nameInput.value);
    if (ok) {
      nameInput.value = "";
      nameInput.focus();
    }
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnAddName.click();
  });

  // New list flow
  btnNew.addEventListener("click", async () => {
    const res1 = await showModal({
      title: "Create new list",
      desc: "Enter fee title and amount.",
      bodyHTML: `<div style="display:flex;flex-direction:column;gap:8px">
          <input id="modalTitleInput" class="input" placeholder="Fee title (e.g., Exam Fee)" />
          <input id="modalAmountInput" class="input" placeholder="Amount (e.g., 2500)" />
        </div>`,
      confirmText: "Next",
      cancelText: "Cancel",
    });
    if (!res1.confirmed) return;
    const titleVal =
      document.getElementById("modalTitleInput").value.trim() || "New Fee";
    const amountVal =
      parseFloat(document.getElementById("modalAmountInput").value) || 0;

    const active = getActiveList();
    const hasSource = !!active;
    if (hasSource) {
      const res2 = await showModal({
        title: "Reuse previous names?",
        desc: "Do you want to copy names from the current active list into this new list? (statuses will be reset to Not Paid)",
        bodyHTML: `<div class="small">Source: <strong>${escapeHtml(
          active.title
        )}</strong> • ${active.names.length} name(s)</div>`,
        confirmText: "Yes, copy names",
        cancelText: "No, start fresh",
      });
      if (res2.confirmed) {
        createList({
          title: titleVal,
          amount: amountVal,
          copyFromId: active.id,
        });
      } else {
        createList({ title: titleVal, amount: amountVal, copyFromId: null });
      }
    } else {
      createList({ title: titleVal, amount: amountVal, copyFromId: null });
    }
  });

  btnDuplicate.addEventListener("click", () => {
    const active = getActiveList();
    if (!active) {
      alert("No active list to duplicate.");
      return;
    }
    duplicateList(active.id);
  });

  btnDeleteList.addEventListener("click", async () => {
    const active = getActiveList();
    if (!active) {
      alert("No list to delete.");
      return;
    }
    const res = await showModal({
      title: "Delete list",
      desc: `This will permanently remove the list "${escapeHtml(
        active.title
      )}" and its names & transactions.`,
      bodyHTML: `<div class="small">Are you sure?</div>`,
      confirmText: "Delete list",
      cancelText: "Cancel",
    });
    if (res.confirmed) {
      deleteList(active.id);
    }
  });

  btnPrint.addEventListener("click", () => doPrint(printSelect.value));
  btnExportJSON.addEventListener("click", exportJSON);
  btnImportJSON.addEventListener("click", importJSON);
  btnExportCSV.addEventListener("click", exportTransactionsCSV);
  btnClearNotPaid.addEventListener("click", clearNotPaid);

  // Print global summary
  btnPrintGlobal.addEventListener("click", () => {
    const headerHtml = `<h2>100L MBBS Financial Summary Report</h2>
      <div style="color:#6b7280;margin-bottom:12px">Generated: ${new Date().toLocaleString()}</div>`;
    let tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">List Title</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Names</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Amount</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Paid</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Income</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Expenses</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;text-align:left">Net</th>
        </tr>
      </thead>
      <tbody>`;
    lists.forEach((l) => {
      const paidCount = l.names.filter((n) => n.status === "paid").length;
      const income = paidCount * l.amount;
      const expense = (l.txs || [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      tableHtml += `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(
          l.title
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${
          l.names.length
        }</td>
        <td style="padding:8px;border-bottom:1px solid #eee">₦${numberWithCommas(
          l.amount
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${paidCount}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">₦${numberWithCommas(
          income
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">₦${numberWithCommas(
          expense
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">₦${numberWithCommas(
          income - expense
        )}</td>
      </tr>`;
    });

    // Add totals row
    const totalPaid = lists.reduce(
      (s, l) => s + l.names.filter((n) => n.status === "paid").length,
      0
    );
    const totalIncome = lists.reduce((s, l) => {
      const paidCount = l.names.filter((n) => n.status === "paid").length;
      return s + paidCount * l.amount;
    }, 0);
    const totalExpenses = lists.reduce(
      (s, l) =>
        s +
        (l.txs || [])
          .filter((t) => t.type === "expense")
          .reduce((ss, t) => ss + Number(t.amount), 0),
      0
    );

    tableHtml += `<tr style="font-weight:bold;background:#f8fafc">
      <td style="padding:8px;border-bottom:1px solid #ddd">TOTAL</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${lists.reduce(
        (s, l) => s + l.names.length,
        0
      )}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">-</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${totalPaid}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">₦${numberWithCommas(
        totalIncome
      )}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">₦${numberWithCommas(
        totalExpenses
      )}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">₦${numberWithCommas(
        totalIncome - totalExpenses
      )}</td>
    </tr>`;

    tableHtml += `</tbody></table>
      <div style="margin-top:18px;color:#555;font-size:13px">Generated from 100L MBBS Financial Records</div>`;

    const win = window.open("", "_blank", "width=900,height=600");
    win.document
      .write(`<!doctype html><html><head><meta charset="utf-8"/><title>Global Summary</title>
      <style>body{font-family:Inter,Arial;padding:28px;color:#111}h2{margin:0 0 12px 0}@media print{@page{margin:20mm}body{padding:0}}</style>
      </head><body>${headerHtml}${tableHtml}<script>window.print();</script></body></html>`);
    win.document.close();
  });

  // transactions
  btnAddTx.addEventListener("click", () => {
    if (!getActiveList()) {
      alert("Create a list first");
      return;
    }
    const amountVal = Number(txAmount.value) || 0;
    if (!amountVal) {
      alert("Enter a valid amount");
      return;
    }
    const typeVal = txType.value;
    const cat = txCategory.value.trim();
    const dateVal = txDate.value || new Date().toISOString().slice(0, 10);
    const descVal = txDesc.value.trim();
    addTransaction({
      type: typeVal,
      amount: amountVal,
      category: cat,
      date: dateVal,
      desc: descVal,
    });
    // clear inputs
    txAmount.value = "";
    txCategory.value = "";
    txDate.value = "";
    txDesc.value = "";
  });

  btnApplyTxFilter.addEventListener("click", renderTxTable);
  btnClearTxFilter.addEventListener("click", () => {
    txFilterType.value = "all";
    txFilterFrom.value = "";
    txFilterTo.value = "";
    renderTxTable();
  });
}

/* ---------- import / export / print helpers ---------- */
function exportJSON() {
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), lists },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payment-lists-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON() {
  showModal({
    title: "Import JSON",
    desc: "Paste the JSON backup.",
    bodyHTML: `<textarea id="importJsonArea" class="input" style="height:160px; font-family:monospace; white-space:pre-wrap"></textarea>`,
    confirmText: "Import",
    cancelText: "Cancel",
  }).then((res) => {
    if (!res.confirmed) return;
    const area = document.getElementById("importJsonArea");
    if (!area) return;
    try {
      const obj = JSON.parse(area.value);
      if (obj && obj.lists) {
        lists = Array.isArray(obj.lists) ? obj.lists : obj;
      } else if (Array.isArray(obj)) {
        lists = obj;
      } else {
        alert("Invalid JSON structure.");
        return;
      }
      // normalize
      lists = lists.map((l) => ({
        id: l.id || "L_" + uid(6),
        title: l.title || "Imported Fee",
        amount: Number(l.amount) || 0,
        createdAt: l.createdAt || new Date().toISOString(),
        names: Array.isArray(l.names)
          ? l.names.map((n) => ({
              id: n.id || "N_" + uid(6),
              name: n.name || "",
              status: n.status === "paid" ? "paid" : "not_paid",
            }))
          : [],
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
      if (lists.length) activeListId = lists[0].id;
      saveToStorage();
      render();
      alert("Import successful");
    } catch (e) {
      alert("Failed to parse JSON: " + e.message);
    }
  });
}

function doPrint(filter = "all") {
  const list = getActiveList();
  if (!list) {
    alert("No active list to print.");
    return;
  }
  const printableRows = list.names
    .filter((n) =>
      filter === "all"
        ? true
        : filter === "paid"
        ? n.status === "paid"
        : n.status === "not_paid"
    )
    .map((n) => ({
      name: n.name,
      status: n.status,
      amount: list.amount,
      title: list.title,
    }));

  const headerHtml = `<div style="margin-bottom:12px"><h2>${escapeHtml(
    list.title
  )}</h2><div style="color:#6b7280">Amount: ₦${numberWithCommas(
    list.amount
  )} • Created: ${new Date(list.createdAt).toLocaleString()}</div></div>`;
  const rowsHtml = printableRows
    .map(
      (r) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(
          r.name
        )}</td><td style="padding:8px;border-bottom:1px solid #eee">₦${numberWithCommas(
          r.amount
        )}</td><td style="padding:8px;border-bottom:1px solid #eee">${
          r.status === "paid" ? "Paid" : "Not Paid"
        }</td></tr>`
    )
    .join("");
  const tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Name</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Amount</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Status</th></tr></thead><tbody>${
    rowsHtml ||
    `<tr><td colspan="3" style="padding:8px;color:#6b7280">No records to print.</td></tr>`
  }</tbody></table>`;

  const win = window.open("", "_blank", "width=900,height=600");
  if (!win) {
    alert("Pop-up blocked. Allow pop-ups to print.");
    return;
  }
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>Print - ${escapeHtml(
      list.title
    )}</title><style>body{font-family:Inter,Arial;padding:28px;color:#111}h2{margin:0 0 8px 0}@media print{@page{margin:20mm}body{padding:0}}</style></head><body>${headerHtml}${tableHtml}<div style="margin-top:18px;color:#555;font-size:13px">Generated from 100L MBBS Financial Records</div><script>window.print();</script></body></html>`
  );
  win.document.close();
}

function exportTransactionsCSV() {
  const list = getActiveList();
  if (!list) {
    alert("No active list to export.");
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
  a.download = `${(list.title || "transactions").replace(
    /\s+/g,
    "_"
  )}_transactions.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- helpers ---------- */
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

/* ---------- start ---------- */
// Initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
