const COINS = [
  { id: "usdc", symbol: "USDC", name: "USD Coin", network: "Robinhood Chain", rate: 1, stable: true, evm: true },
  { id: "eth", symbol: "ETH", name: "Ether", network: "Robinhood Chain", rate: 3450, stable: false, evm: true },
  { id: "usdt", symbol: "USDT", name: "Tether", network: "Ethereum", rate: 1, stable: true, evm: true },
  { id: "sol", symbol: "SOL", name: "Solana", network: "Solana", rate: 178, stable: false, evm: false }
];

const SAMPLE_FEED = [
  ["$4,200", "CH-4BTSU2"],
  ["$20,000", "CH-4PVR9K"],
  ["$850", "CH-N7KCM6"],
  ["$6,400", "CH-Q2LM8A"],
  ["$1,250", "CH-8HD21P"]
];

const state = {
  user: null,
  coin: COINS[0],
  orders: [],
  steps: {},
  tab: "current"
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem("chain-demo") || "{}");
    state.user = raw.user || null;
    state.orders = raw.orders || [];
    state.steps = raw.steps || {};
  } catch {
    state.user = null;
  }
}

function save() {
  localStorage.setItem("chain-demo", JSON.stringify({
    user: state.user,
    orders: state.orders,
    steps: state.steps
  }));
}

function money(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quote(amount, coin) {
  const amt = Math.max(0, Number(amount) || 0);
  const fee = amt === 0 ? 0 : amt * 0.02 + 0.5;
  const net = Math.max(0, amt - fee);
  const received = coin.stable ? net : net / coin.rate;
  return { amt, fee, net, received };
}

function show(page) {
  const name = page || "home";
  $$(".page").forEach((el) => el.classList.toggle("on", el.dataset.page === name));
  $$("[data-go]").forEach((el) => el.classList.toggle("on", el.dataset.go === name));
  const hash = name === "home" ? "#home" : "#" + name;
  if (location.hash !== hash) history.replaceState(null, "", hash);
  $("#mnav").classList.remove("open");
  $("#menu").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "swap") renderSwap();
  if (name === "portfolio") renderPortfolio();
  if (name === "card") renderCard();
  if (name === "orders") renderOrders();
}

function renderSession() {
  const signed = Boolean(state.user);
  $("#signed-out").hidden = signed;
  $("#signed-in").hidden = !signed;
  const homeSign = $("#home-signin");
  if (homeSign) homeSign.hidden = signed;
  if (signed) {
    $("#who-name").textContent = state.user.name;
    $("#who-bal").textContent = "$" + money(state.user.balance);
    $("#av").textContent = state.user.name.slice(0, 1);
  }
  renderSwap();
  renderPortfolio();
  renderCard();
  renderOrders();
}

function selectedAmount() {
  const input = $("#send-amt");
  return input ? input.value : "1000";
}

function renderSwap() {
  const coin = state.coin;
  const q = quote($("#send-amt") ? $("#send-amt").value : 1000, coin);
  $("#recv-amt").value = q.received.toLocaleString("en-US", {
    minimumFractionDigits: coin.stable ? 2 : 4,
    maximumFractionDigits: coin.stable ? 2 : 4
  });
  $("#fee-line").textContent = "−$" + money(q.fee);
  $("#recv-line").textContent = $("#recv-amt").value + " " + coin.symbol;
  $("#rate-line").textContent = coin.stable
    ? "1 " + coin.symbol + " = $1.00"
    : "1 " + coin.symbol + " = $" + coin.rate.toLocaleString("en-US");
  $("#coin-btn-sym").textContent = coin.symbol;
  $("#coin-btn-net").textContent = coin.network;
  $("#addr").placeholder = coin.evm ? "0x… wallet on " + coin.network : "Solana address";
  $("#addr-label").textContent = "Your " + coin.network + " address";
  const locked = !state.user;
  $("#send-amt").disabled = locked;
  $("#addr").disabled = locked;
  $("#memo").disabled = locked;
  $("#coin-btn").disabled = locked;
  $("#swap-go").textContent = locked ? "Continue with Robinhood" : "Swap now";
  $("#swap-gate").hidden = !locked;
  $("#swap-form").hidden = locked;
}

function validAddress(value, coin) {
  const v = value.trim();
  if (!v) return false;
  if (coin.evm) return /^0x[a-fA-F0-9]{40}$/.test(v);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CH-";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function createOrder() {
  if (!state.user) {
    openSignin();
    return;
  }
  const amount = Number($("#send-amt").value);
  const address = $("#addr").value.trim();
  const hint = $("#hint");
  if (!amount || amount < 2 || amount > 20000) {
    hint.textContent = "Enter an amount from $2 to $20,000.";
    return;
  }
  if (!validAddress(address, state.coin)) {
    hint.textContent = state.coin.evm
      ? "Paste a 0x address for " + state.coin.network + "."
      : "Paste a Solana address.";
    return;
  }
  hint.textContent = "";
  const q = quote(amount, state.coin);
  const order = {
    id: code(),
    amount,
    fee: q.fee,
    receive: q.received,
    symbol: state.coin.symbol,
    network: state.coin.network,
    address,
    memo: $("#memo").value.trim(),
    status: "waiting",
    at: Date.now()
  };
  state.orders.unshift(order);
  save();
  renderOrders();
  show("orders");
  $("#active-order").hidden = false;
  paintActive(order);
}

function paintActive(order) {
  $("#ao-code").textContent = order.id;
  $("#ao-status").textContent = labelStatus(order.status);
  $("#ao-sent").textContent = "$" + money(order.amount);
  $("#ao-recv").textContent = order.receive.toLocaleString("en-US", { maximumFractionDigits: 4 }) + " " + order.symbol;
  $("#ao-to").textContent = shortAddr(order.address);
  $("#ao-net").textContent = order.network;
  const map = { waiting: 1, sent: 2, received: 3, completed: 4 };
  $$("#ao-ticks i").forEach((bar, i) => {
    bar.style.opacity = i < (map[order.status] || 1) ? "1" : "0.25";
  });
  $("#ao-next").hidden = order.status === "completed";
  $("#ao-next").textContent = order.status === "waiting"
    ? "I've sent it"
    : order.status === "sent"
      ? "Demo: mark payment received"
      : "Demo: mark coins sent";
}

function labelStatus(status) {
  return {
    waiting: "Waiting for payment",
    sent: "Payment sent",
    received: "Payment received",
    completed: "Completed"
  }[status] || status;
}

function shortAddr(addr) {
  if (addr.length < 12) return addr;
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function advance(order) {
  const next = { waiting: "sent", sent: "received", received: "completed" };
  order.status = next[order.status] || order.status;
  save();
  paintActive(order);
  renderOrders();
}

function renderOrders() {
  const list = $("#order-list");
  const items = state.orders.filter((o) => state.tab === "history" ? o.status === "completed" : o.status !== "completed");
  if (!state.user) {
    list.innerHTML = "<p class='empty'>Sign in to see orders stored in this browser.</p>";
    return;
  }
  if (!items.length) {
    list.innerHTML = "<p class='empty'>No " + (state.tab === "history" ? "completed" : "open") + " orders in this demo.</p>";
    return;
  }
  list.innerHTML = items.map((o) => `
    <article class="order glass">
      <div>
        <b>${o.id}</b>
        <div class="sub">${labelStatus(o.status)} · ${o.network}</div>
      </div>
      <div style="text-align:right">
        <b>$${money(o.amount)}</b>
        <div class="sub">${o.receive.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${o.symbol}</div>
      </div>
    </article>
  `).join("");
  list.querySelectorAll(".order").forEach((node, i) => {
    node.addEventListener("click", () => {
      $("#active-order").hidden = false;
      paintActive(items[i]);
    });
  });
}

function renderPortfolio() {
  const gate = $("#port-gate");
  const body = $("#port-body");
  if (!state.user) {
    gate.hidden = false;
    body.hidden = true;
    return;
  }
  gate.hidden = true;
  body.hidden = false;
  $("#bal").textContent = "$" + money(state.user.balance);
  const unlock = new Date("2026-10-04T04:00:00Z");
  const left = unlock - Date.now();
  $("#unlock-when").textContent = "October 4, 2026, 12:00 AM US Eastern";
  if (left > 0) {
    const days = Math.floor(left / 86400000);
    const hours = Math.floor((left % 86400000) / 3600000);
    $("#countdown").textContent = days + "d " + hours + "h";
    $("#withdraw").disabled = true;
  } else {
    $("#countdown").textContent = "open";
    $("#withdraw").disabled = false;
  }
}

function renderCard() {
  const gate = $("#card-gate");
  const body = $("#card-body");
  if (!state.user) {
    gate.hidden = false;
    body.hidden = true;
    return;
  }
  gate.hidden = true;
  body.hidden = false;
  const n = state.user.member.toLocaleString("en-US");
  $("#mnum").textContent = "#" + n;
  $("#mcode").textContent = state.user.code;
  $("#card-num").textContent = "CH 0000 " + String(state.user.member).padStart(4, "0") + " ···· 2026";
  $("#invite").textContent = location.origin + location.pathname + "?ref=" + state.user.code;
  const done = ["follow", "like", "repost", "card", "reply", "telegram"].filter((k) => state.steps[k]).length;
  $("#step-count").textContent = done + " of 6 steps";
  $$("[data-step]").forEach((row) => row.classList.toggle("done", Boolean(state.steps[row.dataset.step])));
}

function openSignin() {
  $("#signin").classList.add("open");
}

function closeSignin() {
  $("#signin").classList.remove("open");
}

function signIn() {
  state.user = {
    name: "Alex",
    handle: "alex",
    member: 1024,
    code: "K7Q2MX",
    balance: 48
  };
  save();
  closeSignin();
  renderSession();
}

function signOut() {
  state.user = null;
  save();
  renderSession();
  show("home");
}

function bootFeed() {
  const feed = $("#feed");
  feed.innerHTML = SAMPLE_FEED.slice(0, 3).map(([amt, id]) => tickRow(amt, id)).join("");
  let i = 0;
  setInterval(() => {
    i = (i + 1) % SAMPLE_FEED.length;
    const [amt, id] = SAMPLE_FEED[i];
    const row = document.createElement("div");
    row.innerHTML = tickRow(amt, id);
    feed.prepend(row.firstElementChild);
    while (feed.children.length > 3) feed.lastElementChild.remove();
  }, 4200);
}

function tickRow(amt, id) {
  return `<div class="tick"><span class="bub">$</span><span class="bub mark2">C</span><span><b>Chain desk</b> sent you ${amt} for “${id}”</span></div>`;
}

function bootCoins() {
  const row = $("#coin-row");
  row.innerHTML = COINS.map((c) => `<span class="coin" title="${c.symbol} · ${c.network}">${c.symbol.slice(0, 1)}</span>`).join("");
  const menu = $("#coin-menu");
  menu.innerHTML = COINS.map((c) => `<button type="button" data-coin="${c.id}"><b>${c.symbol}</b> · ${c.name}<small style="display:block;color:var(--fg3)">${c.network}</small></button>`).join("");
  menu.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.coin = COINS.find((c) => c.id === btn.dataset.coin);
      menu.classList.remove("open");
      renderSwap();
    });
  });
}

function bootChart() {
  const heights = [18, 24, 32, 28, 40, 55, 62, 70, 64, 78, 88, 100];
  $("#chart").innerHTML = heights.map((h) => `<i style="height:${h}%"></i>`).join("");
  const nets = [
    ["Robinhood Chain", 6420],
    ["Ethereum", 2180],
    ["Solana", 1940],
    ["Base", 980],
    ["Arbitrum", 640],
    ["Other", 480]
  ];
  const max = nets[0][1];
  $("#nets").innerHTML = nets.map(([name, n]) => `
    <div class="barline"><span>${name}</span><div class="track"><span style="width:${Math.round(n / max * 100)}%"></span></div><b>${n.toLocaleString("en-US")}</b></div>
  `).join("");
  const times = [["<15m", 2104], ["15–30m", 3488], ["30–45m", 3012], ["45–60m", 1860], ["1–2h", 940], ["2h+", 286]];
  const tmax = Math.max(...times.map((t) => t[1]));
  $("#times").innerHTML = times.map(([name, n]) => `
    <div class="barline"><span>${name}</span><div class="track"><span style="width:${Math.round(n / tmax * 100)}%"></span></div><b>${n.toLocaleString("en-US")}</b></div>
  `).join("");
}

function init() {
  load();
  bootFeed();
  bootCoins();
  bootChart();
  renderSession();

  document.body.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      show(go.dataset.go);
    }
    if (event.target.closest("[data-signin]")) openSignin();
    if (event.target.closest("[data-close]")) closeSignin();
  });

  $("#do-signin").addEventListener("click", signIn);
  $("#sign-out").addEventListener("click", signOut);
  $("#menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("#menu").classList.toggle("open");
  });
  $("#hb").addEventListener("click", () => $("#mnav").classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#signed-in")) $("#menu").classList.remove("open");
    if (!e.target.closest("#coin-btn") && !e.target.closest("#coin-menu")) {
      $("#coin-menu").classList.remove("open");
    }
  });

  $("#send-amt").addEventListener("input", renderSwap);
  $("#coin-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("#coin-menu").classList.toggle("open");
  });
  $("#swap-go").addEventListener("click", () => {
    if (!state.user) openSignin();
    else createOrder();
  });
  $("#home-swap").addEventListener("click", () => {
    if (!state.user) openSignin();
    else show("swap");
  });
  $("#ao-next").addEventListener("click", () => {
    const id = $("#ao-code").textContent;
    const order = state.orders.find((o) => o.id === id);
    if (order) advance(order);
  });
  $$(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      $$(".tabs button").forEach((b) => b.classList.toggle("on", b === btn));
      renderOrders();
    });
  });
  $$("[data-step-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.stepBtn;
      state.steps[key] = true;
      save();
      renderCard();
    });
  });
  $("#copy-invite").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#invite").textContent);
      $("#copy-invite").textContent = "Copied";
      setTimeout(() => { $("#copy-invite").textContent = "Copy"; }, 1200);
    } catch {
      $("#copy-invite").textContent = "Select the link";
    }
  });
  $("#withdraw").addEventListener("click", () => {
    if ($("#withdraw").disabled) return;
    $("#hint-port").textContent = "Demo only. No coins were sent.";
  });
  $$("[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-dir]").forEach((b) => b.classList.toggle("on", b === btn));
      const soon = btn.dataset.dir === "in";
      $("#flow-soon").hidden = !soon;
      $("#flow-live").hidden = soon;
    });
  });

  const initial = (location.hash || "#home").slice(1);
  const known = new Set($$(".page").map((p) => p.dataset.page));
  show(known.has(initial) ? initial : "home");
}

init();
