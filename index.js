// index.js — Complete Firebase-synced MBBS Financial Records (grouped-by-date, PDF, export/import)

import { db, ref, set, onValue } from "./firebase.js"; // requires firebase.js to export these

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uid = (n = 8) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + n);
const numberWithCommas = (x) =>
  String(x == null ? "" : x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

/* ---------- config & state ---------- */
const storageKey = "paymentLists_v3";
let state = { lists: [], activeListId: null };
const userPath = "users/demoUser/state"; // change when you add auth

/* ---------- DOM refs (may be null if HTML differs) ---------- */
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

let txListContainer = $("#txList"); // preferred container id for bullet-list UI
const txTbody = $("#txTbody"); // fallback anchor if necessary

const totalIncomeEl = $("#totalIncome");
const totalExpensesEl = $("#totalExpenses");
const netBalanceEl = $("#netBalance");

const globalTotalIncome = $("#globalTotalIncome");
const globalTotalExpenses = $("#globalTotalExpenses");
const globalNetBalance = $("#globalNetBalance");

/* ---------- storage + firebase sync ---------- */
function loadLocal() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse local storage state:", e);
    state = { lists: [], activeListId: null };
  }
}

function saveLocalAndCloud() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save local state:", e);
  }
  // try write to firebase; ignore if fails
  try {
    set(ref(db, userPath), state).catch((err) =>
      console.warn("Firebase set error:", err)
    );
  } catch (e) {
    console.warn("Firebase set not available:", e);
  }
  render();
}

function initSyncFromFirebase() {
  try {
    onValue(ref(db, userPath), (snapshot) => {
      const cloud = snapshot.val();
      if (cloud && Array.isArray(cloud.lists)) {
        state = cloud;
        try {
          localStorage.setItem(storageKey, JSON.stringify(state));
        } catch {}
        render();
      } else {
        // if cloud empty, still render current local state
        render();
      }
    });
  } catch (e) {
    console.warn("Firebase onValue not available:", e);
    render();
  }
}

/* ---------- utilities ---------- */
function getActiveList() {
  return state.lists.find((l) => l.id === state.activeListId) || null;
}

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

function ensureTxListContainer() {
  if ($("#txList")) {
    txListContainer = $("#txList");
    return;
  }
  // if txTbody exists, remove table and create txList next to table-wrap
  if (txTbody) {
    const parent = txTbody.closest(".table-wrap") || txTbody.parentElement;
    if (parent) {
      const table = parent.querySelector("table");
      if (table) table.remove();
      const div = document.createElement("div");
      div.id = "txList";
      div.className = "tx-list";
      parent.appendChild(div);
      txListContainer = div;
      return;
    }
  }
  // fallback: create at end of main
  const main = document.querySelector("main");
  if (main && !txListContainer) {
    const div = document.createElement("div");
    div.id = "txList";
    div.className = "tx-list";
    main.appendChild(div);
    txListContainer = div;
  }
}

/* ---------- CRUD operations ---------- */
function createList(title = "New Fee") {
  const id = "L_" + uid(6);
  const newList = {
    id,
    title: title || "New Fee",
    createdAt: new Date().toISOString(),
    txs: [],
  };
  state.lists.unshift(newList);
  state.activeListId = id;
  saveLocalAndCloud();
}

function addTransactionToActive({
  type = "income",
  amount = 0,
  category = "",
  date = null,
  desc = "",
}) {
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
  saveLocalAndCloud();
  return true;
}

function deleteTx(txId) {
  const list = getActiveList();
  if (!list) return;
  list.txs = (list.txs || []).filter((t) => t.id !== txId);
  saveLocalAndCloud();
}

function deleteList(listId) {
  if (!confirm("Delete this entire fee list?")) return;
  state.lists = state.lists.filter((l) => l.id !== listId);
  if (state.activeListId === listId)
    state.activeListId = state.lists[0]?.id || null;
  saveLocalAndCloud();
}

/* ---------- rendering ---------- */
function renderLists() {
  if (!listsEl) return;
  listsEl.innerHTML = "";
  if (!state.lists.length) {
    listsEl.innerHTML =
      '<div class="small">No lists yet — click New List to begin.</div>';
    if (summaryEl) summaryEl.textContent = "No lists saved";
    return;
  }

  state.lists.forEach((l) => {
    const totals = calcTotals(l);
    const wrapper = document.createElement("div");
    wrapper.className =
      "list-item" + (l.id === state.activeListId ? " active" : "");
    wrapper.dataset.id = l.id;
    wrapper.innerHTML = `
      <div>
        <strong>${escapeHtml(l.title)}</strong>
        <div class="small">${new Date(l.createdAt).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="small">₦${numberWithCommas(totals.net)}</div>
        <button class="btn ghost btn-del-list" title="Delete list" style="color:#ef4444;border:none;font-weight:700">🗑️</button>
      </div>
    `;
    // delete listener
    wrapper.querySelector(".btn-del-list").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteList(l.id);
    });
    // select list
    wrapper.addEventListener("click", () => {
      state.activeListId = l.id;
      saveLocalAndCloud();
    });
    listsEl.appendChild(wrapper);
  });

  if (summaryEl) summaryEl.textContent = `${state.lists.length} list(s) saved`;
}

function renderActive() {
  ensureTxListContainer();
  const active = getActiveList();
  if (!active) {
    if (feeTitleDisplay) feeTitleDisplay.textContent = "No active list";
    if (feeAmountDisplay)
      feeAmountDisplay.textContent = "Create a list to begin";
    if (listDate) listDate.textContent = "";
    if (txListContainer) txListContainer.innerHTML = "";
    if (totalIncomeEl) totalIncomeEl.textContent = "₦0";
    if (totalExpensesEl) totalExpensesEl.textContent = "₦0";
    if (netBalanceEl) netBalanceEl.textContent = "₦0";
    return;
  }

  if (feeTitleDisplay) feeTitleDisplay.textContent = active.title;
  if (feeAmountDisplay)
    feeAmountDisplay.textContent = `Transactions: ${active.txs.length}`;
  if (listDate)
    listDate.textContent =
      "Created: " + new Date(active.createdAt).toLocaleString();

  // filter (if present)
  const filterTypeVal = txFilterType ? txFilterType.value : "all";
  const fromVal = txFilterFrom ? txFilterFrom.value : "";
  const toVal = txFilterTo ? txFilterTo.value : "";

  let txs = active.txs || [];
  if (filterTypeVal && filterTypeVal !== "all")
    txs = txs.filter((t) => t.type === filterTypeVal);
  if (fromVal) txs = txs.filter((t) => t.date >= fromVal);
  if (toVal) txs = txs.filter((t) => t.date <= toVal);

  // group by date (YYYY-MM-DD)
  const grouped = txs.reduce((acc, t) => {
    const d = t.date || new Date().toISOString().slice(0, 10);
    (acc[d] = acc[d] || []).push(t);
    return acc;
  }, {});

  // render into txListContainer as bullets grouped by date
  if (txListContainer) {
    const dates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)); // desc
    if (!dates.length) {
      txListContainer.innerHTML = `<div class="muted-small">No transactions for this list.</div>`;
    } else {
      const parts = [];
      dates.forEach((d) => {
        parts.push(
          `<div class="tx-date-group" style="margin-bottom:10px"><strong>${escapeHtml(
            d
          )}</strong><ul style="margin:6px 0 10px 18px">`
        );
        grouped[d].forEach((t) => {
          parts.push(
            `<li style="margin-bottom:6px"><strong>${
              t.type === "income" ? "Income" : "Expense"
            }</strong> — ₦${numberWithCommas(t.amount)}${
              t.category ? ` • ${escapeHtml(t.category)}` : ""
            }${t.desc ? ` — ${escapeHtml(t.desc)}` : ""} <button data-id="${
              t.id
            }" class="btn ghost btn-del-tx" style="color:#ef4444;border:none;font-weight:700">🗑️</button></li>`
          );
        });
        parts.push(`</ul></div>`);
      });
      txListContainer.innerHTML = parts.join("");
      // attach delete listeners
      txListContainer.querySelectorAll(".btn-del-tx").forEach((b) => {
        b.addEventListener("click", (e) => {
          const id = b.getAttribute("data-id");
          if (!id) return;
          if (confirm("Delete this transaction?")) deleteTx(id);
        });
      });
    }
  } else if (txTbody) {
    // fallback rendering into table-body (kept for backward compat)
    if (!Object.keys(grouped).length) {
      txTbody.innerHTML = `<tr><td colspan="6" class="muted-small">No transactions</td></tr>`;
    } else {
      txTbody.innerHTML = "";
      const dates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
      dates.forEach((d) => {
        grouped[d].forEach((t) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${t.date}</td><td>${
            t.type === "income" ? "Income" : "Expense"
          }</td><td>₦${numberWithCommas(t.amount)}</td><td>${escapeHtml(
            t.category
          )}</td><td>${escapeHtml(
            t.desc
          )}</td><td><button class="btn ghost btn-del-tx" data-id="${
            t.id
          }" style="color:#ef4444;border:none;font-weight:700">🗑️</button></td>`;
          tr.querySelector(".btn-del-tx").addEventListener("click", () => {
            if (confirm("Delete this transaction?")) deleteTx(t.id);
          });
          txTbody.appendChild(tr);
        });
      });
    }
  }

  const totals = calcTotals(active);
  if (totalIncomeEl)
    totalIncomeEl.textContent = "₦" + numberWithCommas(totals.income);
  if (totalExpensesEl)
    totalExpensesEl.textContent = "₦" + numberWithCommas(totals.expense);
  if (netBalanceEl) {
    netBalanceEl.textContent = "₦" + numberWithCommas(totals.net);
    netBalanceEl.style.color =
      totals.net >= 0 ? "var(--success)" : "var(--danger)";
  }
}

function renderGlobalSummary() {
  if (!globalTotalIncome || !globalTotalExpenses || !globalNetBalance) return;
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

/* ---------- export / import / CSV ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
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
}

function importJSONFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.lists))
          throw new Error("Invalid format");
        // normalize
        state = {
          lists: obj.lists.map((l) => ({
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
          })),
          activeListId:
            obj.activeListId || (obj.lists[0] && obj.lists[0].id) || null,
        };
        saveLocalAndCloud();
        alert("Import successful");
      } catch (err) {
        alert("Failed to import JSON: " + (err.message || err));
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportActiveCSV() {
  const list = getActiveList();
  if (!list) return alert("No active list");
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
}

/* ---------- PDF generation (html2canvas + jsPDF) ---------- */
async function ensurePdfLibs() {
  if (window.html2canvas && window.jspdf) return;
  // html2canvas
  if (!window.html2canvas) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    }).catch((e) => console.warn("Failed to load html2canvas", e));
  }
  // jspdf
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    }).catch((e) => console.warn("Failed to load jspdf", e));
  }
}

async function generatePdfFromHtmlString(
  htmlString,
  fileName = "100L_MBBS_Financial_Records.pdf"
) {
  await ensurePdfLibs();
  if (!window.html2canvas || !window.jspdf)
    throw new Error("PDF libraries unavailable");

  const { jsPDF } = window.jspdf;
  const wrapper = document.createElement("div");
  wrapper.style.width = "900px";
  wrapper.style.background = "#fff";
  wrapper.style.padding = "24px";
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.innerHTML = htmlString;
  document.body.appendChild(wrapper);

  const canvas = await html2canvas(wrapper, { scale: 2 });
  const img = canvas.toDataURL("image/jpeg", 0.95);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
  const renderWidth = imgWidth * ratio;
  const renderHeight = imgHeight * ratio;

  // If image fits on single page
  if (renderHeight <= pageHeight) {
    pdf.addImage(
      img,
      "JPEG",
      (pageWidth - renderWidth) / 2,
      20,
      renderWidth,
      renderHeight
    );
  } else {
    // split vertically into pages
    // draw parts by slicing the canvas
    const canvasPageHeight = Math.floor(pageHeight / ratio); // px
    let y = 0;
    while (y < canvas.height) {
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(canvasPageHeight, canvas.height - y);
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0,
        y,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height
      );
      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
      const sliceRenderHeight = sliceCanvas.height * ratio;
      if (y > 0) pdf.addPage();
      pdf.addImage(
        sliceData,
        "JPEG",
        (pageWidth - renderWidth) / 2,
        20,
        renderWidth,
        sliceRenderHeight
      );
      y += canvasPageHeight;
    }
  }

  pdf.save(fileName);
  wrapper.remove();
}

/* ---------- Build printable HTML ---------- */
function buildGlobalSummaryHtml() {
  const header = `<h1 style="margin:0 0 10px 0;color:#111">100L MBBS Financial Records</h1><div style="color:#6b7280;margin-bottom:12px">Generated: ${new Date().toLocaleString()}</div>`;
  let body = "";
  if (!state.lists.length) body += `<div>No fee lists found.</div>`;
  state.lists.forEach((list) => {
    const totals = calcTotals(list);
    const grouped = (list.txs || []).reduce((acc, t) => {
      const d = t.date || new Date().toISOString().slice(0, 10);
      (acc[d] = acc[d] || []).push(t);
      return acc;
    }, {});
    const dates = Object.keys(grouped).sort((a, b) => (a < b ? -1 : 1));
    body += `<section style="margin-bottom:18px;padding:12px;border:1px solid #eee;border-radius:8px;background:#fff">
      <h2 style="margin:0 0 8px 0;color:#2563eb">${escapeHtml(list.title)}</h2>
      <div style="margin-bottom:8px"><strong>Total Income:</strong> ₦${numberWithCommas(
        totals.income
      )}</div>
      <div style="margin-bottom:8px"><strong>Total Expenses:</strong> ₦${numberWithCommas(
        totals.expense
      )}</div>
      <div style="margin-bottom:8px"><strong>Net:</strong> ₦${numberWithCommas(
        totals.net
      )}</div>
      <div style="margin-top:10px">`;
    if (!dates.length) {
      body += `<div style="color:#6b7280">No transactions</div>`;
    } else {
      dates.forEach((date) => {
        body += `<div style="margin-top:6px"><strong>${escapeHtml(
          date
        )}</strong><ul style="margin:6px 0 8px 18px">`;
        grouped[date].forEach((t) => {
          body += `<li>${
            t.type === "income" ? "Income" : "Expense"
          } — ₦${numberWithCommas(t.amount)}${
            t.category ? ` • ${escapeHtml(t.category)}` : ""
          }${t.desc ? ` — ${escapeHtml(t.desc)}` : ""}</li>`;
        });
        body += `</ul></div>`;
      });
    }
    body += `</div></section>`;
  });

  const global = calcGlobalTotals();
  body += `<section style="padding:12px;border-top:2px solid #eee">
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

  return `<div style="font-family:Inter,Arial;color:#111">${header}${body}</div>`;
}

/* ---------- events ---------- */
function wireEvents() {
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      const title = prompt("Create new fee list (title):");
      if (!title) return;
      createList(title);
    });
  }

  if (btnAddTx) {
    btnAddTx.addEventListener("click", () => {
      const list = getActiveList();
      if (!list) return alert("Create a fee list first.");
      const type = (txType && txType.value) || "income";
      const amount = Number(txAmount && txAmount.value);
      const category = (txCategory && txCategory.value) || "";
      const date =
        (txDate && txDate.value) || new Date().toISOString().slice(0, 10);
      const desc = (txDesc && txDesc.value) || "";
      if (!amount || isNaN(amount) || amount <= 0)
        return alert("Enter a valid amount.");
      const ok = addTransactionToActive({ type, amount, category, date, desc });
      if (ok) {
        if (txAmount) txAmount.value = "";
        if (txCategory) txCategory.value = "";
        if (txDate) txDate.value = "";
        if (txDesc) txDesc.value = "";
      }
    });
  }

  if (btnApplyTxFilter) btnApplyTxFilter.addEventListener("click", render);
  if (btnClearTxFilter) {
    btnClearTxFilter.addEventListener("click", () => {
      if (txFilterType) txFilterType.value = "all";
      if (txFilterFrom) txFilterFrom.value = "";
      if (txFilterTo) txFilterTo.value = "";
      render();
    });
  }

  if (btnExportJSON) btnExportJSON.addEventListener("click", exportJSON);
  if (btnImportJSON) btnImportJSON.addEventListener("click", importJSONFile);
  if (btnExportTXCSV) btnExportTXCSV.addEventListener("click", exportActiveCSV);

  if (btnPrintList) {
    btnPrintList.addEventListener("click", async () => {
      const list = getActiveList();
      if (!list) return alert("No active list to print.");
      const header = `<h1 style="margin:0 0 10px 0;color:#111">100L MBBS Financial Records</h1><div style="color:#6b7280;margin-bottom:8px">List: ${escapeHtml(
        list.title
      )}</div><div style="color:#6b7280;margin-bottom:8px">Generated: ${new Date().toLocaleString()}</div>`;
      let body = "";
      const grouped = (list.txs || []).reduce(
        (acc, t) => ((acc[t.date] = acc[t.date] || []).push(t), acc),
        {}
      );
      const dates = Object.keys(grouped).sort((a, b) => (a < b ? -1 : 1));
      const totals = calcTotals(list);
      body += `<div style="margin-top:12px"><div style="margin-bottom:10px"><strong>Total Income:</strong> ₦${numberWithCommas(
        totals.income
      )}</div><div style="margin-bottom:10px"><strong>Total Expenses:</strong> ₦${numberWithCommas(
        totals.expense
      )}</div><div style="margin-bottom:10px"><strong>Net Balance:</strong> ₦${numberWithCommas(
        totals.net
      )}</div></div>`;
      if (!dates.length)
        body += `<div style="color:#6b7280">No transactions</div>`;
      else {
        dates.forEach((d) => {
          body += `<div style="margin-top:6px"><strong>${escapeHtml(
            d
          )}</strong><ul style="margin:6px 0 12px 18px">`;
          grouped[d].forEach((t) => {
            body += `<li>${
              t.type === "income" ? "Income" : "Expense"
            } — ₦${numberWithCommas(t.amount)} ${
              t.category ? "• " + escapeHtml(t.category) : ""
            } ${t.desc ? "— " + escapeHtml(t.desc) : ""}</li>`;
          });
          body += `</ul></div>`;
        });
      }
      const html = `${header}${body}`;
      try {
        await generatePdfFromHtmlString(
          html,
          `${list.title.replace(/\s+/g, "_")}_100L_MBBS.pdf`
        );
      } catch (err) {
        console.error("PDF failed:", err);
        const win = window.open("", "_blank");
        win.document.write(
          `<html><head><title>${escapeHtml(
            list.title
          )}</title></head><body>${html}</body></html>`
        );
        win.document.close();
        win.print();
      }
    });
  }

  if (btnPrintGlobal) {
    btnPrintGlobal.addEventListener("click", async () => {
      const html = buildGlobalSummaryHtml();
      try {
        await generatePdfFromHtmlString(
          html,
          "100L_MBBS_Financial_Records.pdf"
        );
      } catch (err) {
        console.error("PDF failed:", err);
        const win = window.open("", "_blank");
        win.document.write(
          `<html><head><title>100L MBBS Financial Records</title></head><body>${html}</body></html>`
        );
        win.document.close();
        win.print();
      }
    });
  }
}

/* ---------- init ---------- */
function start() {
  loadLocal();
  ensureTxListContainer();
  initSyncFromFirebase(); // will call render on updates
  wireEvents();
  render(); // initial render
}

start();
