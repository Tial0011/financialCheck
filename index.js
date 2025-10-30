// === Modal Setup ===
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalBody = document.getElementById("modalBody");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

let modalConfirmHandler = null;

function showModal(title, desc, onConfirm) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc || "";
  modalBackdrop.hidden = false;

  // Reset previous confirm listener
  modalConfirm.replaceWith(modalConfirm.cloneNode(true));
  const newConfirm = document.getElementById("modalConfirm");

  newConfirm.addEventListener("click", () => {
    if (onConfirm) onConfirm();
    closeModal();
  });

  modalCancel.addEventListener("click", closeModal);
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalBody.innerHTML = "";
}

// === App Logic ===

// Example: Data structure for storing lists
let lists = JSON.parse(localStorage.getItem("lists") || "[]");
let activeListIndex = null;

// Elements
const feeTitleDisplay = document.getElementById("feeTitleDisplay");
const feeAmountDisplay = document.getElementById("feeAmountDisplay");
const listDate = document.getElementById("listDate");
const namesTbody = document.getElementById("namesTbody");
const nameInput = document.getElementById("nameInput");
const btnAddName = document.getElementById("btnAddName");
const btnNew = document.getElementById("btnNew");
const btnDeleteList = document.getElementById("btnDeleteList");
const listsContainer = document.getElementById("lists");
const btnDuplicate = document.getElementById("btnDuplicate");
const btnPrint = document.getElementById("btnPrint");
const printSelect = document.getElementById("printSelect");

function saveData() {
  localStorage.setItem("lists", JSON.stringify(lists));
}

function renderLists() {
  listsContainer.innerHTML = "";
  lists.forEach((list, index) => {
    const btn = document.createElement("button");
    btn.textContent = list.title;
    btn.className = "btn ghost";
    if (index === activeListIndex) btn.classList.add("active");
    btn.addEventListener("click", () => {
      activeListIndex = index;
      renderActiveList();
      renderLists();
    });
    listsContainer.appendChild(btn);
  });
}

function renderActiveList() {
  const list = lists[activeListIndex];
  if (!list) return;

  feeTitleDisplay.textContent = list.title;
  feeAmountDisplay.textContent = "₦" + list.amount;
  listDate.textContent = new Date(list.created).toLocaleDateString();

  namesTbody.innerHTML = "";
  list.names.forEach((n, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${n.name}</td>
      <td>${list.title}</td>
      <td>₦${list.amount}</td>
      <td>
        <button class="btn ${n.paid ? "success" : "danger"} togglePaid">
          ${n.paid ? "Paid" : "Not Paid"}
        </button>
      </td>
      <td>
        <button class="btn ghost editName">Edit</button>
        <button class="btn danger deleteName">Delete</button>
      </td>
    `;

    tr.querySelector(".togglePaid").addEventListener("click", () => {
      n.paid = !n.paid;
      saveData();
      renderActiveList();
    });

    tr.querySelector(".editName").addEventListener("click", () => {
      showModal("Edit Name", "Change the name below:", () => {
        const newName = modalBody.querySelector("input").value.trim();
        if (newName) {
          n.name = newName;
          saveData();
          renderActiveList();
        }
      });
      modalBody.innerHTML = `
        <input type="text" class="input" value="${n.name}" placeholder="New name" />
      `;
    });

    tr.querySelector(".deleteName").addEventListener("click", () => {
      showModal("Delete Name", `Remove ${n.name}?`, () => {
        list.names.splice(i, 1);
        saveData();
        renderActiveList();
      });
    });

    namesTbody.appendChild(tr);
  });
}

// Add new name
btnAddName.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) return;
  if (activeListIndex === null) return alert("Select or create a list first!");

  const list = lists[activeListIndex];
  list.names.push({ name, paid: false });
  saveData();
  nameInput.value = "";
  renderActiveList();
});

// Create new list
btnNew.addEventListener("click", () => {
  showModal("New Fee List", "Enter title and amount below:", () => {
    const title = modalBody.querySelector("#newListTitle").value.trim();
    const amount = modalBody.querySelector("#newListAmount").value.trim();
    const reuse = modalBody.querySelector("#reuseNames").checked;

    if (!title || !amount) return alert("Please fill all fields");

    let names = [];
    if (reuse && lists[activeListIndex]) {
      names = lists[activeListIndex].names.map((n) => ({
        name: n.name,
        paid: false,
      }));
    }

    lists.push({
      title,
      amount,
      created: new Date().toISOString(),
      names,
    });

    activeListIndex = lists.length - 1;
    saveData();
    renderLists();
    renderActiveList();
  });

  modalBody.innerHTML = `
    <input id="newListTitle" class="input" placeholder="Fee Title (e.g., Exam Fee)" />
    <input id="newListAmount" class="input" placeholder="Amount (e.g., 2000)" />
    <label style="display:flex;align-items:center;gap:6px;margin-top:8px;">
      <input type="checkbox" id="reuseNames" />
      <span>Use previous names?</span>
    </label>
  `;
});

// Delete list
btnDeleteList.addEventListener("click", () => {
  if (activeListIndex === null) return alert("Select a list first!");
  const list = lists[activeListIndex];
  showModal("Delete List", `Delete list "${list.title}"?`, () => {
    lists.splice(activeListIndex, 1);
    activeListIndex = null;
    saveData();
    renderLists();
    namesTbody.innerHTML = "";
  });
});

// Duplicate list
btnDuplicate.addEventListener("click", () => {
  if (activeListIndex === null) return alert("Select a list first!");
  const list = lists[activeListIndex];
  const copy = JSON.parse(JSON.stringify(list));
  copy.title = list.title + " (Copy)";
  copy.created = new Date().toISOString();
  lists.push(copy);
  saveData();
  renderLists();
});

// Print
btnPrint.addEventListener("click", () => {
  if (activeListIndex === null) return alert("Select a list first!");
  const list = lists[activeListIndex];
  const filter = printSelect.value;

  let rows = list.names;
  if (filter === "paid") rows = rows.filter((n) => n.paid);
  if (filter === "not_paid") rows = rows.filter((n) => !n.paid);

  const printWindow = window.open("", "_blank");
  const html = `
    <html>
      <head><title>${list.title}</title></head>
      <body>
        <h2>${list.title} — ₦${list.amount}</h2>
        <table border="1" cellspacing="0" cellpadding="8">
          <tr><th>Name</th><th>Status</th></tr>
          ${rows
            .map(
              (n) =>
                `<tr><td>${n.name}</td><td>${
                  n.paid ? "Paid" : "Not Paid"
                }</td></tr>`
            )
            .join("")}
        </table>
      </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
});

// Initialize
renderLists();
renderActiveList();
