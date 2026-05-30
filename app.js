const STORAGE_KEY = "monthlyExpenseTracker:v3";
const OLD_STORAGE_KEYS = ["monthlyExpenseTracker:v1"];
const TRACKING_START_DATE = "2026-05-25";
const MAY_2026_SALARY = 48452.81;
const JUNE_2026_NORMAL_SALARY = 42400;
const MAY_2026_OPENING_BALANCE = 407.67;
const MAY_2026_SAVINGS_TRANSFER = 10000;
const MAY_2026_CREDIT_USED = 16000;
const MAY_2026_CREDIT_PAID = 14500;
const MAY_2026_OTHER_EXPENSES_MIGRATION = "may2026OtherExpenses";
const RECURRING_NETFLIX_KRAFTRINGEN_MIGRATION = "recurringNetflixKraftringen";

const may2026OtherExpenses = [
  { name: "Ica kvantum", amount: 187.28, date: "2026-05-29", source: "salary" },
  { name: "Rebel", amount: 177, date: "2026-05-28", source: "salary" },
  { name: "Folktandvard", amount: 1082, date: "2026-05-27", source: "salary" },
  { name: "Openai chat", amount: 249, date: "2026-05-26", source: "salary" },
  { name: "Ica kvantum", amount: 229.6, date: "2026-05-26", source: "salary" },
  { name: "Ica kvantum", amount: 76, date: "2026-05-26", source: "salary" },
  { name: "Ica kvantum", amount: 63.31, date: "2026-05-25", source: "salary" },
  { name: "Indo pak lunch", amount: 30, date: "2026-05-25", source: "salary" }
];

const defaultSettings = {
  salary: 42400,
  salaryDay: 25,
  creditAlert: 2000,
  creditLimit: 30000,
  openingMainBalance: MAY_2026_OPENING_BALANCE,
  openingCreditBalance: 0,
  busTicket: 634,
  standardExpenses: [
    { id: "netflix", name: "Netflix", amount: 254, day: 29, frequency: "monthly", account: "salary" },
    { id: "kraftringen", name: "Kraftringen nat ab", amount: 433, day: 28, frequency: "monthly", account: "salary" },
    { id: "sv-ingenj", name: "Sv ingenj", amount: 405, day: 28, frequency: "monthly", account: "salary" },
    { id: "bank-fee", name: "Enkla vardag", amount: 50, day: 28, frequency: "monthly", account: "salary" },
    { id: "dog-insurance", name: "Hedvig dog insurance", amount: 969, day: 27, frequency: "monthly", account: "salary" },
    { id: "housing-fee", name: "Housing association avgift", amount: 6111, day: 27, frequency: "monthly", account: "salary" },
    { id: "viki", name: "Viki", amount: 45, day: 28, frequency: "monthly", account: "salary" },
    { id: "mortgage", name: "Mortgage", amount: 9459, day: 1, frequency: "monthly", account: "salary" },
    { id: "bus-ticket", name: "Bus monthly ticket", amount: 634, day: 15, frequency: "monthly", account: "salary", linkedSetting: "busTicket" },
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
  mainBalanceAmount: document.getElementById("mainBalanceAmount"),
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
  spendCalc: document.getElementById("spendCalc"),
  settingsExpenseList: document.getElementById("settingsExpenseList")
};

function loadState() {
  OLD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  const currentSaved = localStorage.getItem(STORAGE_KEY);
  const legacySaved = localStorage.getItem("monthlyExpenseTracker:v2");
  const saved = JSON.parse(currentSaved || legacySaved || "null");
  const isLegacySave = !currentSaved && Boolean(legacySaved);
  const initialCycle = cycleKeyForDate(todayOrTrackingStart(), defaultSettings.salaryDay);
  if (!saved) {
    const recurringChanges = {};
    seedSalaryChanges(recurringChanges);
    return {
      settings: structuredClone(defaultSettings),
      manualExpenses: appendMay2026OtherExpenses(initialManualExpenses()),
      extraIncome: [],
      creditPayments: initialCreditPayments(),
      savingsTransfers: initialSavingsTransfers(),
      recurringChanges,
      migrations: { [MAY_2026_OTHER_EXPENSES_MIGRATION]: true },
      selectedCycle: initialCycle
    };
  }

  const selectedCycle = saved.selectedCycle || initialCycle;
  const settings = { ...defaultSettings, ...saved.settings };
  settings.standardExpenses = mergeDefaultExpenses(saved.settings?.standardExpenses);
  settings.standardIncome = defaultSettings.standardIncome;
  const recurringChanges = saved.recurringChanges || migrateRecurringChanges(saved, selectedCycle);
  seedSalaryChanges(recurringChanges);
  const migrations = saved.migrations || {};
  let manualExpenses = saved.manualExpenses?.length || !isLegacySave ? saved.manualExpenses || [] : initialManualExpenses();
  if (!migrations[MAY_2026_OTHER_EXPENSES_MIGRATION]) {
    manualExpenses = appendMay2026OtherExpenses(manualExpenses);
    migrations[MAY_2026_OTHER_EXPENSES_MIGRATION] = true;
  }
  if (!migrations[RECURRING_NETFLIX_KRAFTRINGEN_MIGRATION]) {
    manualExpenses = removeMay2026RecurringManualCopies(manualExpenses);
    migrations[RECURRING_NETFLIX_KRAFTRINGEN_MIGRATION] = true;
  }

  return {
    settings,
    manualExpenses,
    extraIncome: saved.extraIncome || [],
    creditPayments: saved.creditPayments?.length || !isLegacySave ? saved.creditPayments || [] : initialCreditPayments(),
    savingsTransfers: saved.savingsTransfers?.length || !isLegacySave ? saved.savingsTransfers || [] : migrateSavingsTransfers(saved),
    recurringChanges,
    migrations,
    selectedCycle
  };
}

function mergeDefaultExpenses(savedExpenses = []) {
  return defaultSettings.standardExpenses.map((item) => {
    const saved = savedExpenses.find((expense) => expense.id === item.id);
    return saved ? { ...item, amount: Number(saved.amount || item.amount) } : item;
  });
}

function seedSalaryChanges(changes) {
  const salaryChanges = (changes["income:salary"] || []).filter((change) => change.cycle < "2026-05");
  changes["income:salary"] = [
    ...salaryChanges,
    { cycle: "2026-05", amount: MAY_2026_SALARY },
    { cycle: "2026-06", amount: JUNE_2026_NORMAL_SALARY }
  ].sort((a, b) => a.cycle.localeCompare(b.cycle));
}

function migrateSavingsTransfers(saved) {
  if (saved.savingsTransfers) return saved.savingsTransfers;
  return initialSavingsTransfers();
}

function initialSavingsTransfers() {
  return [{ id: crypto.randomUUID(), name: "Lincy savings account", amount: MAY_2026_SAVINGS_TRANSFER, date: "2026-05-29" }];
}

function initialManualExpenses() {
  return [{ id: crypto.randomUUID(), name: "Credit card purchases", amount: MAY_2026_CREDIT_USED, date: "2026-05-25", source: "credit" }];
}

function appendMay2026OtherExpenses(expenses) {
  const exists = (candidate) => expenses.some((expense) => (
    expense.name === candidate.name &&
    expense.date === candidate.date &&
    Number(expense.amount) === Number(candidate.amount) &&
    expense.source === candidate.source
  ));
  const seeded = may2026OtherExpenses
    .filter((expense) => !exists(expense))
    .map((expense) => ({ id: crypto.randomUUID(), ...expense }));
  return [...expenses, ...seeded];
}

function removeMay2026RecurringManualCopies(expenses) {
  return expenses.filter((expense) => !(
    expense.source === "salary" &&
    (
      (expense.name === "Netflix com" && expense.date === "2026-05-29" && Number(expense.amount) === 254) ||
      (expense.name === "Kraftringen nat ab" && expense.date === "2026-05-28" && Number(expense.amount) === 433)
    )
  ));
}

function initialCreditPayments() {
  return [{ id: crypto.randomUUID(), name: "Credit card payment", amount: MAY_2026_CREDIT_PAID, date: "2026-05-25" }];
}

function saveState() {
  pruneOldRecords();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.removeItem("monthlyExpenseTracker:v2");
}

function migrateRecurringChanges(saved, cycle) {
  const changes = {};
  const addChange = (key, amount) => {
    changes[key] = [{ cycle, amount: Number(amount || 0) }];
  };
  if (saved.settings?.salary !== undefined) addChange("income:salary", saved.settings.salary);
  (saved.settings?.standardExpenses || []).forEach((item) => addChange(`expense:${item.id}`, item.amount));
  if (saved.settings?.busTicket !== undefined) addChange("expense:bus-ticket", saved.settings.busTicket);
  return changes;
}

function cycleStartForDate(date, salaryDay = defaultSettings.salaryDay) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, salaryDay);
  return d.getDate() < salaryDay ? new Date(year, month - 1, salaryDay) : start;
}

function cycleKeyForDate(date, salaryDay = defaultSettings.salaryDay) {
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
  const currentStart = cycleStartForDate(todayOrTrackingStart(), state.settings.salaryDay);
  const trackingCycle = cycleKeyForDate(new Date(`${TRACKING_START_DATE}T12:00:00`));
  for (let offset = 0; offset < 3; offset += 1) {
    const monthStart = new Date(currentStart);
    monthStart.setMonth(currentStart.getMonth() - offset);
    const key = cycleKeyForDate(monthStart);
    if (key >= trackingCycle) keys.add(key);
  }
  [...state.manualExpenses, ...state.extraIncome, ...state.creditPayments, ...state.savingsTransfers].forEach((item) => {
    const key = cycleKeyForDate(new Date(`${item.date}T12:00:00`), state.settings.salaryDay);
    if (key >= trackingCycle) keys.add(key);
  });
  return [...keys].sort().reverse().slice(0, 3);
}

function pruneOldRecords() {
  const keep = new Set(cycleKeys());
  const keepItem = (item) => keep.has(cycleKeyForDate(new Date(`${item.date}T12:00:00`), state.settings.salaryDay));
  state.manualExpenses = state.manualExpenses.filter(keepItem);
  state.extraIncome = state.extraIncome.filter(keepItem);
  state.creditPayments = state.creditPayments.filter(keepItem);
  state.savingsTransfers = state.savingsTransfers.filter(keepItem);
}

function effectiveAmount(changeKey, key, fallback) {
  const changes = state.recurringChanges[changeKey] || [];
  const activeChange = changes
    .filter((change) => change.cycle <= key)
    .sort((a, b) => a.cycle.localeCompare(b.cycle))
    .at(-1);
  return Number(activeChange ? activeChange.amount : fallback || 0);
}

function recordRecurringChange(changeKey, amount, cycle = state.selectedCycle) {
  const changes = state.recurringChanges[changeKey] || [];
  const withoutCycle = changes.filter((change) => change.cycle !== cycle);
  state.recurringChanges[changeKey] = [...withoutCycle, { cycle, amount: Number(amount || 0) }]
    .sort((a, b) => a.cycle.localeCompare(b.cycle));
}

function defaultExpenseAmount(item) {
  if (item.linkedSetting) return defaultSettings[item.linkedSetting];
  const defaultItem = defaultSettings.standardExpenses.find((expense) => expense.id === item.id);
  return defaultItem ? defaultItem.amount : item.amount;
}

function defaultIncomeAmount(item) {
  if (item.linkedSetting) return defaultSettings[item.linkedSetting];
  const defaultItem = defaultSettings.standardIncome.find((income) => income.id === item.id);
  return defaultItem ? defaultItem.amount : item.amount;
}

function adjustedExpense(item, key) {
  return { ...item, amount: effectiveAmount(`expense:${item.id}`, key, defaultExpenseAmount(item)) };
}

function adjustedIncome(item, key) {
  return { ...item, amount: effectiveAmount(`income:${item.id}`, key, defaultIncomeAmount(item)) };
}

function activeStandardExpenses(key) {
  const { start, end } = cycleBounds(key);
  return state.settings.standardExpenses
    .map((item) => adjustedExpense(item, key))
    .filter((item) => {
      if (item.frequency === "yearly") {
        const date = new Date(start.getFullYear(), item.month - 1, item.day);
        return date >= start && date <= end;
      }
      return item.amount > 0;
    });
}

function activeStandardIncome(key) {
  return state.settings.standardIncome.map((item) => adjustedIncome(item, key)).filter((item) => item.amount > 0);
}

function cycleData(key) {
  const balances = balancesBeforeCycle(key);
  const standardIncome = activeStandardIncome(key);
  const extraIncome = state.extraIncome.filter((item) => dateInCycle(item.date, key));
  const standardExpenses = activeStandardExpenses(key);
  const savingsTransfers = state.savingsTransfers.filter((item) => dateInCycle(item.date, key));
  const manualExpenses = state.manualExpenses.filter((item) => dateInCycle(item.date, key));
  const salaryManual = manualExpenses.filter((item) => item.source === "salary");
  const creditManual = manualExpenses.filter((item) => item.source === "credit");
  const creditPayments = state.creditPayments.filter((item) => dateInCycle(item.date, key));

  const income = sum([...standardIncome, ...extraIncome]);
  const standardSpend = sum(standardExpenses);
  const savingsTotal = sum(savingsTransfers);
  const salaryManualSpend = sum(salaryManual);
  const creditSpend = sum(creditManual);
  const creditPaid = sum(creditPayments);
  const creditBalance = Math.max(0, balances.credit + creditSpend - creditPaid);
  const totalExpenses = standardSpend + savingsTotal + salaryManualSpend + creditSpend;
  const salarySpend = standardSpend + savingsTotal + salaryManualSpend + creditPaid;
  const mainBalance = balances.main + income - salarySpend;
  const plannedAvailable = mainBalance - creditBalance;

  return {
    openingMainBalance: balances.main,
    openingCreditBalance: balances.credit,
    standardIncome,
    extraIncome,
    standardExpenses,
    debitOrders: standardExpenses,
    savingsTransfers,
    manualExpenses,
    salaryManual,
    creditManual,
    creditPayments,
    income,
    standardSpend,
    savingsTotal,
    salaryManualSpend,
    totalExpenses,
    creditSpend,
    creditPaid,
    creditBalance,
    salarySpend,
    mainBalance,
    plannedAvailable
  };
}

function rawCycleTotals(key) {
  const standardIncome = activeStandardIncome(key);
  const extraIncome = state.extraIncome.filter((item) => dateInCycle(item.date, key));
  const standardExpenses = activeStandardExpenses(key);
  const savingsTransfers = state.savingsTransfers.filter((item) => dateInCycle(item.date, key));
  const manualExpenses = state.manualExpenses.filter((item) => dateInCycle(item.date, key));
  const creditPayments = state.creditPayments.filter((item) => dateInCycle(item.date, key));
  return {
    income: sum([...standardIncome, ...extraIncome]),
    mainSpend: sum(standardExpenses) + sum(savingsTransfers) + sum(manualExpenses.filter((item) => item.source === "salary")) + sum(creditPayments),
    creditSpend: sum(manualExpenses.filter((item) => item.source === "credit")),
    creditPaid: sum(creditPayments)
  };
}

function balancesBeforeCycle(key) {
  let main = Number(state.settings.openingMainBalance || 0);
  let credit = Number(state.settings.openingCreditBalance || 0);
  for (const cycle of cyclesFromTrackingStartThrough(key)) {
    if (cycle === key) break;
    const totals = rawCycleTotals(cycle);
    main += totals.income - totals.mainSpend;
    credit = Math.max(0, credit + totals.creditSpend - totals.creditPaid);
  }
  return { main, credit };
}

function cyclesFromTrackingStartThrough(key) {
  const keys = [];
  const startKey = cycleKeyForDate(new Date(`${TRACKING_START_DATE}T12:00:00`), state.settings.salaryDay);
  const [endYear, endMonth] = key.split("-").map(Number);
  const cursor = new Date(`${startKey}-${String(state.settings.salaryDay).padStart(2, "0")}T12:00:00`);
  const end = new Date(endYear, endMonth - 1, state.settings.salaryDay);
  while (cursor <= end) {
    keys.push(cycleKeyForDate(cursor, state.settings.salaryDay));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function savingsDataThrough(key) {
  const trackingStart = new Date(`${TRACKING_START_DATE}T12:00:00`);
  const { end } = cycleBounds(key);
  const keys = cyclesFromTrackingStartThrough(key);
  return {
    cycleCount: Math.max(1, keys.length),
    total: sum(state.savingsTransfers.filter((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      return date >= trackingStart && date <= end;
    }))
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
  const savings = savingsDataThrough(state.selectedCycle);
  const { start, end } = cycleBounds(state.selectedCycle);
  els.availableAmount.textContent = money(data.mainBalance);
  document.getElementById("availableAmountMirror").textContent = money(data.plannedAvailable);
  els.incomeAmount.textContent = money(data.income);
  els.salarySpendAmount.textContent = money(data.salarySpend);
  els.creditBalanceAmount.textContent = money(data.creditBalance);
  els.wifeSavingsAmount.textContent = money(savings.total);
  els.mainBalanceAmount.textContent = money(data.mainBalance);
  document.getElementById("totalIncomeAmount").textContent = money(data.income);
  document.getElementById("totalExpenseAmount").textContent = money(data.totalExpenses);
  document.getElementById("totalSavingsAmount").textContent = money(savings.total);
  document.getElementById("totalSavingsHint").textContent = `${savings.cycleCount} salary month${savings.cycleCount === 1 ? "" : "s"} since ${TRACKING_START_DATE}`;
  els.creditHint.textContent = `${money(data.creditBalance)} used of ${money(state.settings.creditLimit)} limit`;
  els.cycleLabel.textContent = `${start.toLocaleDateString("sv-SE")} to ${end.toLocaleDateString("sv-SE")}`;
  els.creditSummaryCard.classList.toggle("alerting", data.creditBalance > state.settings.creditAlert);

  renderAlerts(data);
  renderSpendCalculation(data);
  renderList(els.incomeList, [
    ...data.standardIncome.map((item) => ({ ...item, canRemove: false })),
    ...data.extraIncome.map((item) => ({ ...item, canEdit: true, canRemove: true, collection: "extraIncome" }))
  ], state.selectedCycle, "income");
  renderList(els.standardExpenseList, data.debitOrders.map((item) => ({ ...item, canEdit: true, editType: "debitOrder" })), state.selectedCycle, "standard");
  renderSectionTotal(els.standardExpenseList, "Total debit orders", data.standardSpend);
  renderList(els.wifeSavingsList, data.savingsTransfers.map((item) => ({ ...item, canEdit: true, canRemove: true, collection: "savingsTransfers" })), state.selectedCycle, "savings");
  renderSectionTotal(els.wifeSavingsList, "Total savings transfers this cycle", data.savingsTotal);
  renderList(els.manualExpenseList, data.salaryManual.map((item) => ({ ...item, canEdit: true, canRemove: true, collection: "manualExpenses" })), state.selectedCycle, "manual");
  renderSectionTotal(els.manualExpenseList, "Total manual expenses", data.salaryManualSpend);
  renderList(els.creditList, [
    ...data.creditManual.map((item) => ({ ...item, canEdit: true, canRemove: true, collection: "manualExpenses" })),
    ...data.creditPayments.map((item) => ({ ...item, name: `Payment: ${item.name}`, canEdit: true, canRemove: true, collection: "creditPayments" }))
  ], state.selectedCycle, "credit");
  renderCreditSectionTotals(els.creditList, data);
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
  if (data.mainBalance < 0) {
    alerts.push({ type: "warn", title: "Budget pressure", detail: `Your main account is ${money(Math.abs(data.mainBalance))} below zero for this cycle.` });
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

function renderSpendCalculation(data) {
  const rows = [
    ["Opening main balance", data.openingMainBalance],
    ["Income this cycle", data.income],
    ["Debit orders", -data.standardSpend],
    ["Savings transfers", -data.savingsTotal],
    ["Manual expenses from main account", -data.salaryManualSpend],
    ["Credit card payments from main account", -data.creditPaid],
    ["Available to spend in main account", data.mainBalance, "strong"],
    ["Credit card balance, shown separately", data.creditBalance],
    ["If credit card is cleared now", data.plannedAvailable]
  ];
  els.spendCalc.innerHTML = rows.map(([label, value, tone]) => `
    <div class="calcRow ${tone || ""}">
      <span>${label}</span>
      <strong>${money(value)}</strong>
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
    if (item.canEdit || item.canRemove) {
      const actions = document.createElement("div");
      actions.className = "rowActions";
      if (item.canEdit) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.setAttribute("aria-label", `Edit ${item.name}`);
        editButton.addEventListener("click", () => editRecord(item));
        actions.appendChild(editButton);
      }
      if (item.canRemove) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "dangerAction";
        deleteButton.setAttribute("aria-label", `Delete ${item.name}`);
        deleteButton.addEventListener("click", () => removeRecord(item.id));
        actions.appendChild(deleteButton);
      }
      row.appendChild(actions);
    }
    container.appendChild(row);
  });
}

function renderSectionTotal(container, label, amount) {
  const row = document.createElement("div");
  row.className = "sectionTotal";
  row.innerHTML = `<span>${label}</span><strong>${money(amount)}</strong>`;
  container.appendChild(row);
}

function renderCreditSectionTotals(container, data) {
  const totals = document.createElement("div");
  totals.className = "sectionTotalsStack";
  totals.innerHTML = `
    <div class="sectionTotal"><span>Total credit card purchases</span><strong>${money(data.creditSpend)}</strong></div>
    <div class="sectionTotal"><span>Total payments from main account</span><strong>${money(data.creditPaid)}</strong></div>
    <div class="sectionTotal balanceTotal"><span>Credit card balance</span><strong>${money(data.creditBalance)}</strong></div>
  `;
  container.appendChild(totals);
}

function renderHistory(keys) {
  els.historyList.innerHTML = keys.map((key) => {
    const data = cycleData(key);
    return `
      <article class="historyCycle">
        <h3>${cycleTitle(key)}</h3>
        <div class="historyStats">
          <div class="statPill"><span>Income</span><strong>${money(data.income)}</strong></div>
          <div class="statPill"><span>Money out</span><strong>${money(data.totalExpenses)}</strong></div>
          <div class="statPill"><span>Savings transfer</span><strong>${money(data.savingsTotal)}</strong></div>
          <div class="statPill"><span>Main balance</span><strong>${money(data.mainBalance)}</strong></div>
          <div class="statPill"><span>Credit balance</span><strong>${money(data.creditBalance)}</strong></div>
          <div class="statPill"><span>Available</span><strong>${money(data.plannedAvailable)}</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSettings() {
  els.settingsExpenseList.innerHTML = state.settings.standardExpenses.map((item) => {
    const adjusted = adjustedExpense(item, state.selectedCycle);
    return `
      <label class="settingsAmountRow">
        <div>
          <strong>${adjusted.name}</strong>
          <small>${adjusted.frequency === "yearly" ? "Yearly" : "Monthly"} - day ${adjusted.day}</small>
        </div>
        <input data-expense-id="${item.id}" type="number" min="0" step="1" value="${adjusted.amount}">
      </label>
    `;
  }).join("");
}

function fillSettingsForm() {
  document.getElementById("salaryInput").value = effectiveAmount("income:salary", state.selectedCycle, defaultSettings.salary);
  document.getElementById("salaryDayInput").value = state.settings.salaryDay;
  document.getElementById("creditAlertInput").value = state.settings.creditAlert;
  document.getElementById("creditLimitInput").value = state.settings.creditLimit;
  document.getElementById("openingMainBalanceInput").value = state.settings.openingMainBalance;
  document.getElementById("openingCreditBalanceInput").value = state.settings.openingCreditBalance;
}

function removeRecord(id) {
  state.manualExpenses = state.manualExpenses.filter((item) => item.id !== id);
  state.extraIncome = state.extraIncome.filter((item) => item.id !== id);
  state.creditPayments = state.creditPayments.filter((item) => item.id !== id);
  state.savingsTransfers = state.savingsTransfers.filter((item) => item.id !== id);
  saveState();
  render();
}

function editRecord(item) {
  if (item.editType === "debitOrder") {
    editDebitOrder(item);
    return;
  }
  editStoredRecord(item);
}

function editStoredRecord(item) {
  const collection = item.collection;
  const record = state[collection]?.find((entry) => entry.id === item.id);
  if (!record) return;

  const name = window.prompt("Description", record.name);
  if (name === null) return;
  const amount = promptNumber("Amount SEK", record.amount);
  if (amount === null) return;
  const date = window.prompt("Date YYYY-MM-DD", record.date);
  if (date === null) return;
  let source = record.source;

  if (collection === "manualExpenses") {
    const sourceValue = window.prompt("Paid from: salary or credit", record.source || "salary");
    if (sourceValue === null) return;
    source = sourceValue.toLowerCase() === "credit" ? "credit" : "salary";
  }

  record.name = name.trim() || record.name;
  record.amount = amount;
  record.date = date || record.date;
  if (collection === "manualExpenses") record.source = source;

  saveState();
  state.selectedCycle = cycleKeyForDate(new Date(`${record.date}T12:00:00`), state.settings.salaryDay);
  render();
}

function editDebitOrder(item) {
  const record = state.settings.standardExpenses.find((expense) => expense.id === item.id);
  if (!record) return;

  const name = window.prompt("Debit order name", record.name);
  if (name === null) return;
  const amount = promptNumber("Monthly amount SEK", item.amount);
  if (amount === null) return;
  const day = promptNumber("Payment day of month", record.day);
  if (day === null) return;

  record.name = name.trim() || record.name;
  record.amount = amount;
  record.day = Math.min(31, Math.max(1, Math.round(day)));
  if (record.linkedSetting) state.settings[record.linkedSetting] = amount;
  recordRecurringChange(`expense:${record.id}`, amount);
  saveState();
  render();
}

function promptNumber(label, currentValue) {
  const value = window.prompt(label, String(currentValue ?? 0));
  if (value === null) return null;
  const normalized = value.replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    window.alert("Please enter a valid amount.");
    return null;
  }
  return number;
}

function addRecord(collection, record) {
  state[collection].push({ id: crypto.randomUUID(), ...record });
  saveState();
  state.selectedCycle = cycleKeyForDate(new Date(`${record.date}T12:00:00`), state.settings.salaryDay);
  render();
}

function settleCreditCard() {
  const data = cycleData(state.selectedCycle);
  if (!data.creditBalance) return;
  const { start, end } = cycleBounds(state.selectedCycle);
  const today = todayOrTrackingStart();
  const paymentDate = today >= start && today <= end ? today.toISOString().slice(0, 10) : start.toISOString().slice(0, 10);
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
  document.getElementById("savingsDate").value = today;
  document.getElementById("creditPaymentDate").value = today;
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

document.getElementById("savingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addRecord("savingsTransfers", {
    name: document.getElementById("savingsName").value.trim() || "Savings transfer",
    amount: Number(document.getElementById("savingsAmount").value),
    date: document.getElementById("savingsDate").value
  });
  event.target.reset();
  setTodayDefaults();
});

document.getElementById("creditPaymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addRecord("creditPayments", {
    name: document.getElementById("creditPaymentName").value.trim() || "Credit card payment",
    amount: Number(document.getElementById("creditPaymentAmount").value),
    date: document.getElementById("creditPaymentDate").value
  });
  event.target.reset();
  setTodayDefaults();
});

document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const salary = Number(document.getElementById("salaryInput").value);
  state.settings.salary = salary;
  state.settings.salaryDay = Number(document.getElementById("salaryDayInput").value);
  state.settings.creditAlert = Number(document.getElementById("creditAlertInput").value);
  state.settings.creditLimit = Number(document.getElementById("creditLimitInput").value);
  state.settings.openingMainBalance = Number(document.getElementById("openingMainBalanceInput").value);
  state.settings.openingCreditBalance = Number(document.getElementById("openingCreditBalanceInput").value);
  recordRecurringChange("income:salary", salary);
  document.querySelectorAll("[data-expense-id]").forEach((input) => {
    const item = state.settings.standardExpenses.find((expense) => expense.id === input.dataset.expenseId);
    const amount = Number(input.value);
    if (!item) return;
    item.amount = amount;
    if (item.linkedSetting) state.settings[item.linkedSetting] = amount;
    recordRecurringChange(`expense:${item.id}`, amount);
  });
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
