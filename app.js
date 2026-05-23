const STORAGE_KEY = "monthlyExpenseTracker:v2";
const OLD_STORAGE_KEYS = ["monthlyExpenseTracker:v1"];
const TRACKING_START_DATE = "2026-05-25";

const defaultSettings = {
  salary: 42400,
  salaryDay: 25,
  creditAlert: 2000,
  creditLimit: 30000,
  wifeSavings: 20000,
  busTicket: 634,
  standardExpenses: [
    { id: "netflix", name: "Netflix", amount: 254, day: 25, frequency: "monthly", account: "salary" },
    { id: "dog-insurance", name: "Hedvig dog insurance", amount: 969, day: 25, frequency: "monthly", account: "salary" },
    { id: "union-akassa", name: "Unionen / A-kassa", amount: 434, day: 25, frequency: "monthly", account: "salary" },
    { id: "electricity-grid", name: "Electricity grid", amount: 460, day: 25, frequency: "monthly", account: "salary" },
    { id: "bank-fee", name: "Bank account monthly fee", amount: 50, day: 25, frequency: "monthly", account: "salary" },
    { id: "mortgage", name: "Mortgage", amount: 9469, day: 25, frequency: "monthly", account: "salary" },
    { id: "housing-fee", name: "Housing association avgift", amount: 6111, day: 25, frequency: "monthly", account: "salary" },
    { id: "bus-ticket", name: "Bus monthly ticket", amount: 634, day: 15, frequency: "monthly", account: "salary", linkedSetting: "busTicket" },
    { id: "wife-savings", name: "Travel/car savings with wife", amount: 20000, day: 25, frequency: "monthly", account: "salary", linkedSetting: "wifeSavings", category: "wife-savings" },
    { id: "prime", name: "Amazon Prime", amount: 569, day: 25, month: 1, frequency: "yearly", account: "salary" }
  ],
  standardIncome: [
    { id: "salary", name: "Net salary", amount: 42400, day: 25, frequency: "monthly", linkedSetting: "salary" },
    { id: "netflix-neighbor", name: "Neighbor Netflix reimbursement", amount: 117, day: 23, frequency: "monthly" }
  ]
};

let state = loadState();

const fmt = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric" });

const els = {
  cycleSelect: document.getElementById("cycleSelect"),
  availableAmount: document.getElementById("availableAmount"),
  incomeAmount: document.getElementById("incomeAmount"),
  salarySpendAmount: document.getElementById("salarySpendAmount"),
  creditBalanceAmount: document.getElementById("creditBalanceAmount"),
  wifeSavingsAmount: document.getElementById("wifeSavingsAmount"),
  creditHint: document.getElementById("creditHint"),
  creditSummaryCard: document.getElementById("creditSummaryCard"),
  cycleLabel: document.getElementById("cycleLabel"),
  alerts: document.getElementById("alerts"),
  incomeList: document.getElementById("incomeList"),
  standardExpenseList: document.getElementById("standardExpenseList"),
  wifeSavingsList: document.getElementById("wifeSavingsList"),
  manualExpenseList: document.getElementById("manualExpenseList"),
  creditList: document.getElementById("creditList"),
  historyList: document.getElementById("historyList"),
  settingsExpenseList: document.getElementById("settingsExpenseList")
};

function loadState() {
  OLD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  const initialCycle = cycleKeyForDate(todayOrTrackingStart(), defaultSettings.salaryDay);
  if (saved) {
    return {
      settings: { ...defaultSettings, ...saved.settings },
      manualExpenses: saved.manualExpenses || [],
      extraIncome: saved.extraIncome || [],
      creditPayments: saved.creditPayments || [],
      selectedCycle: saved.selectedCycle || initialCycle
    };
  }
  return {
    settings: structuredClone(defaultSettings),
    manualExpenses: [],
    extraIncome: [],
    creditPayments: [],
    selectedCycle: initialCycle
  };
}

function saveState() {
  pruneOldRecords();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cycleStartForDate(date, salaryDay = state.settings.salaryDay) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, salaryDay);
  if (d.getDate() < salaryDay) {
    return new Date(year, month - 1, salaryDay);
  }
  return start;
}

function cycleKeyForDate(date, salaryDay = state.settings.salaryDay) {
  const start = cycleStartForDate(date, salaryDay);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
}

function todayOrTrackingStart() {
  const today = new Date();
  const trackingStart = new Date(`${TRACKING_START_DATE}T12:00:00`);
  return today < trackingStart ? trackingStart : today;
}

function cycleBounds(key) {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(year, month - 1, state.settings.salaryDay);
  const end = new Date(year, month, state.settings.salaryDay);
  end.setDate(end.getDate() - 1);
  return { start, end };
}

function dateInCycle(dateString, key) {
  const { start, end } = cycleBounds(key);
  const date = new Date(`${dateString}T12:00:00`);
  return date >= start && date <= end;
}

function cycleKeys() {
  const keys = new Set();
  const currentStart = cycleStartForDate(todayOrTrackingStart());
  const trackingCycle = cycleKeyForDate(new Date(`${TRACKING_START_DATE}T12:00:00`));
  for (let offset = 0; offset < 3; offset += 1) {
    const monthStart = new Date(currentStart);
    monthStart.setMonth(currentStart.getMonth() - offset);
    const key = cycleKeyForDate(monthStart);
    if (key >= trackingCycle) keys.add(key);
  }
  [...state.manualExpenses, ...state.extraIncome, ...state.creditPayments].forEach((item) => {
    const key = cycleKeyForDate(new Date(`${item.date}T12:00:00`));
    if (key >= trackingCycle) keys.add(key);
  });
  return [...keys].sort().reverse().slice(0, 3);
}

function pruneOldRecords() {
  const keep = new Set(cycleKeys());
  state.manualExpenses = state.manualExpenses.filter((item) => keep.has(cycleKeyForDate(new Date(`${item.date}T12:00:00`))));
  state.extraIncome = state.extraIncome.filter((item) => keep.has(cycleKeyForDate(new Date(`${item.date}T12:00:00`))));
  state.creditPayments = state.creditPayments.filter((item) => keep.has(cycleKeyForDate(new Date(`${item.date}T12:00:00`))));
}

function adjustedExpense(item) {
  if (item.linkedSetting) {
    return { ...item, amount: Number(state.settings[item.linkedSetting] || 0) };
  }
  return item;
}

function adjustedIncome(item) {
  if (item.linkedSetting) {
    return { ...item, amount: Number(state.settings[item.linkedSetting] || 0) };
  }
  return item;
}

function activeStandardExpenses(key) {
  const { start, end } = cycleBounds(key);
  return state.settings.standardExpenses
    .map(adjustedExpense)
    .filter((item) => {
      if (item.frequency === "yearly") {
        const date = new Date(start.getFullYear(), item.month - 1, item.day);
        return date >= start && date <= end;
      }
      return true;
    });
}

function activeStandardIncome(key) {
  return state.settings.standardIncome.map(adjustedIncome).filter((item) => item.amount > 0);
}

function cycleData(key) {
  const standardIncome = activeStandardIncome(key);
  const extraIncome = state.extraIncome.filter((item) => dateInCycle(item.date, key));
  const standardExpenses = activeStandardExpenses(key);
  const wifeSavings = standardExpenses.filter((item) => item.category === "wife-savings");
  const debitOrders = standardExpenses.filter((item) => item.category !== "wife-savings");
  const manualExpenses = state.manualExpenses.filter((item) => dateInCycle(item.date, key));
  const salaryManual = manualExpenses.filter((item) => item.source === "salary");
  const creditManual = manualExpenses.filter((item) => item.source === "credit");
  const creditPayments = state.creditPayments.filter((item) => dateInCycle(item.date, key));

  const income = sum([...standardIncome, ...extraIncome]);
  const standardSpend = sum(standardExpenses);
  const wifeSavingsTotal = sum(wifeSavings);
  const salaryManualSpend = sum(salaryManual);
  const creditSpend = sum(creditManual);
  const creditPaid = sum(creditPayments);
  const creditBalance = Math.max(0, creditSpend - creditPaid);
  const salarySpend = standardSpend + salaryManualSpend + creditPaid;
  const plannedAvailable = income - salarySpend - creditBalance;

  return {
    standardIncome,
    extraIncome,
    standardExpenses,
    debitOrders,
    wifeSavings,
    manualExpenses,
    salaryManual,
    creditManual,
    creditPayments,
    income,
    standardSpend,
    wifeSavingsTotal,
    salaryManualSpend,
    creditSpend,
    creditPaid,
    creditBalance,
    salarySpend,
    plannedAvailable
  };
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function money(value) {
  return fmt.format(Number(value || 0));
}

function itemDate(item, key) {
  if (item.date) return shortDate.format(new Date(`${item.date}T12:00:00`));
  const { start } = cycleBounds(key);
  const date = item.frequency === "yearly"
    ? new Date(start.getFullYear(), item.month - 1, item.day)
    : new Date(start.getFullYear(), start.getMonth() + (item.day < state.settings.salaryDay ? 1 : 0), item.day);
  return shortDate.format(date);
}

function render() {
  const keys = cycleKeys();
  if (!keys.includes(state.selectedCycle)) state.selectedCycle = keys[0];
  els.cycleSelect.innerHTML = keys.map((key) => `<option value="${key}">${cycleTitle(key)}</option>`).join("");
  els.cycleSelect.value = state.selectedCycle;

  const data = cycleData(state.selectedCycle);
  const { start, end } = cycleBounds(state.selectedCycle);
  els.availableAmount.textContent = money(data.plannedAvailable);
  els.incomeAmount.textContent = money(data.income);
  els.salarySpendAmount.textContent = money(data.salarySpend);
  els.creditBalanceAmount.textContent = money(data.creditBalance);
  els.wifeSavingsAmount.textContent = money(data.wifeSavingsTotal);
  els.creditHint.textContent = `${money(data.creditBalance)} used of ${money(state.settings.creditLimit)} limit`;
  els.cycleLabel.textContent = `${start.toLocaleDateString("sv-SE")} to ${end.toLocaleDateString("sv-SE")}`;
  els.creditSummaryCard.classList.toggle("alerting", data.creditBalance > state.settings.creditAlert);

  renderAlerts(data);
  renderList(els.incomeList, [...data.standardIncome, ...data.extraIncome], state.selectedCycle, "income");
  renderList(els.standardExpenseList, data.debitOrders, state.selectedCycle, "standard");
  renderList(els.wifeSavingsList, data.wifeSavings, state.selectedCycle, "savings");
  renderList(els.manualExpenseList, data.salaryManual, state.selectedCycle, "manual");
  renderList(els.creditList, [...data.creditManual, ...data.creditPayments.map((item) => ({ ...item, name: `Payment: ${item.name}` }))], state.selectedCycle, "credit");
  renderHistory(keys);
  renderSettings();
  fillSettingsForm();
}

function cycleTitle(key) {
  const { start, end } = cycleBounds(key);
  return `${start.toLocaleDateString("sv-SE", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("sv-SE", { month: "short", day: "numeric" })}`;
}

function renderAlerts(data) {
  const alerts = [];
  if (data.creditBalance > state.settings.creditAlert) {
    alerts.push({ type: "danger", title: "Credit card alert", detail: `Balance is ${money(data.creditBalance)}, above your ${money(state.settings.creditAlert)} alert level.` });
  }
  if (data.creditBalance > state.settings.creditLimit) {
    alerts.push({ type: "danger", title: "Credit limit exceeded", detail: `Credit usage is above the ${money(state.settings.creditLimit)} card limit.` });
  }
  if (data.plannedAvailable < 0) {
    alerts.push({ type: "warn", title: "Budget pressure", detail: `This cycle is ${money(Math.abs(data.plannedAvailable))} short after planned card payoff.` });
  }
  if (!alerts.length) {
    alerts.push({ type: "", title: "Budget status", detail: "No active alarms for this salary month." });
  }
  els.alerts.innerHTML = alerts.map((alert) => `
    <div class="alert ${alert.type}">
      <strong>${alert.title}</strong>
      <small>${alert.detail}</small>
    </div>
  `).join("");
}

function renderList(container, items, key, type) {
  if (!items.length) {
    container.innerHTML = `<div class="rowItem"><div><strong>No records</strong><small>Add items from the Add tab.</small></div><span>${money(0)}</span></div>`;
    return;
  }
  container.innerHTML = "";
  items.forEach((item) => {
    const row = document.getElementById("rowTemplate").content.firstElementChild.cloneNode(true);
    row.querySelector("strong").textContent = item.name;
    row.querySelector("small").textContent = `${itemDate(item, key)}${item.source ? ` - ${item.source === "credit" ? "Credit card" : "Salary account"}` : ""}`;
    row.querySelector("span").textContent = money(item.amount);
    if (type === "manual" || (type === "credit" && item.source === "credit") || type === "income") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Remove";
      button.addEventListener("click", () => removeRecord(item.id));
      row.appendChild(button);
    }
    container.appendChild(row);
  });
}

function renderHistory(keys) {
  els.historyList.innerHTML = keys.map((key) => {
    const data = cycleData(key);
    return `
      <article class="historyCycle">
        <h3>${cycleTitle(key)}</h3>
        <div class="historyStats">
          <div class="statPill"><span>Income</span><strong>${money(data.income)}</strong></div>
          <div class="statPill"><span>Salary spend</span><strong>${money(data.salarySpend)}</strong></div>
          <div class="statPill"><span>Credit balance</span><strong>${money(data.creditBalance)}</strong></div>
          <div class="statPill"><span>Available</span><strong>${money(data.plannedAvailable)}</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSettings() {
  els.settingsExpenseList.innerHTML = state.settings.standardExpenses.map((item) => {
    const adjusted = adjustedExpense(item);
    return `
      <div class="rowItem">
        <div>
          <strong>${adjusted.name}</strong>
          <small>${adjusted.frequency === "yearly" ? "Yearly" : "Monthly"} - day ${adjusted.day}</small>
        </div>
        <span>${money(adjusted.amount)}</span>
      </div>
    `;
  }).join("");
}

function fillSettingsForm() {
  document.getElementById("salaryInput").value = state.settings.salary;
  document.getElementById("salaryDayInput").value = state.settings.salaryDay;
  document.getElementById("creditAlertInput").value = state.settings.creditAlert;
  document.getElementById("creditLimitInput").value = state.settings.creditLimit;
  document.getElementById("wifeSavingsInput").value = state.settings.wifeSavings;
  document.getElementById("busInput").value = state.settings.busTicket;
}

function removeRecord(id) {
  state.manualExpenses = state.manualExpenses.filter((item) => item.id !== id);
  state.extraIncome = state.extraIncome.filter((item) => item.id !== id);
  saveState();
  render();
}

function addRecord(collection, record) {
  state[collection].push({ id: crypto.randomUUID(), ...record });
  saveState();
  state.selectedCycle = cycleKeyForDate(new Date(`${record.date}T12:00:00`));
  render();
}

function settleCreditCard() {
  const data = cycleData(state.selectedCycle);
  if (!data.creditBalance) return;
  const { start } = cycleBounds(state.selectedCycle);
  const date = new Date(start);
  date.setMonth(date.getMonth() + 1);
  const paymentDate = date.toISOString().slice(0, 10);
  state.creditPayments.push({
    id: crypto.randomUUID(),
    name: "Credit card payoff",
    amount: data.creditBalance,
    date: paymentDate
  });
  saveState();
  render();
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("expenseDate").value = today;
  document.getElementById("incomeDate").value = today;
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}Panel`).classList.add("active");
  });
});

els.cycleSelect.addEventListener("change", () => {
  state.selectedCycle = els.cycleSelect.value;
  saveState();
  render();
});

document.getElementById("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addRecord("manualExpenses", {
    name: document.getElementById("expenseName").value.trim(),
    amount: Number(document.getElementById("expenseAmount").value),
    date: document.getElementById("expenseDate").value,
    source: document.getElementById("expenseSource").value
  });
  event.target.reset();
  setTodayDefaults();
});

document.getElementById("incomeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addRecord("extraIncome", {
    name: document.getElementById("incomeName").value.trim(),
    amount: Number(document.getElementById("incomeValue").value),
    date: document.getElementById("incomeDate").value
  });
  event.target.reset();
  setTodayDefaults();
});

document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.salary = Number(document.getElementById("salaryInput").value);
  state.settings.salaryDay = Number(document.getElementById("salaryDayInput").value);
  state.settings.creditAlert = Number(document.getElementById("creditAlertInput").value);
  state.settings.creditLimit = Number(document.getElementById("creditLimitInput").value);
  state.settings.wifeSavings = Number(document.getElementById("wifeSavingsInput").value);
  state.settings.busTicket = Number(document.getElementById("busInput").value);
  saveState();
  render();
});

document.getElementById("settleCreditBtn").addEventListener("click", settleCreditCard);

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

setTodayDefaults();
saveState();
render();
