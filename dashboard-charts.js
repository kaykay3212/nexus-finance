"use strict";

(() => {
  const colors = ["#d6b400", "#c8c8c2", "#766923", "#777777", "#a38d35", "#555555"];
  const labels = {
    balance: "Saldo do mês",
    income: "Entradas por categoria",
    expense: "Saídas por categoria",
    savings: "Economia do mês",
    investments: "Investimentos por categoria",
    pending: "Compromissos por categoria"
  };
  let context = null;
  let hideTimer = null;
  let pinned = false;

  function totalOf(items) {
    return items.reduce((total, item) => total + item.value, 0);
  }

  function aggregate(records) {
    const groups = new Map();
    records.forEach(record => {
      const category = record.category || "Outros";
      groups.set(category, (groups.get(category) || 0) + Number(record.amount || 0));
    });
    return [...groups.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  function capItems(items) {
    const visible = items.filter(item => item.value > 0).slice(0, 5);
    const hiddenTotal = items.filter(item => item.value > 0).slice(5)
      .reduce((total, item) => total + item.value, 0);
    if (hiddenTotal) visible.push({ label: "Outras categorias", value: hiddenTotal });
    return visible;
  }

  function itemsFor(key) {
    const selectedMonth = context.getMonth();
    const records = context.getRecords().filter(record => context.getRecordMonthKey(record) === selectedMonth);
    const realized = records.filter(context.isRealized);
    const month = context.getMonthData();

    if (key === "balance") {
      return [
        { label: "Entradas", value: month.income },
        { label: "Saídas", value: month.expense }
      ];
    }
    if (key === "income") return aggregate(realized.filter(record => record.type === "Entrada"));
    if (key === "expense") return aggregate(realized.filter(record => record.type === "Saída"));
    if (key === "savings") {
      return [
        { label: "Saídas realizadas", value: month.expense },
        { label: "Saldo economizado", value: Math.max(month.balance, 0) }
      ];
    }
    if (key === "investments") {
      return aggregate(realized.filter(record => record.type === "Saída" && (
        record.classification === "Investimento" ||
        record.category === "Investimentos" ||
        record.category === "Reserva" ||
        record.mode === "Renda Fixa"
      )));
    }
    if (key === "pending") {
      return aggregate(records.filter(record => ["Compromisso", "Assinatura"].includes(record.mode) && !context.isRealized(record)));
    }
    return [];
  }

  function render(card) {
    const key = card.dataset.dashboardChart;
    const items = capItems(itemsFor(key));
    const total = totalOf(items);
    const pie = document.querySelector("#dashboardPie");
    const title = document.querySelector("#dashboardChartTitle");
    const totalLabel = document.querySelector("#dashboardPieTotal");
    const legend = document.querySelector("#dashboardChartLegend");
    const note = document.querySelector("#dashboardChartNote");
    const route = document.querySelector("#dashboardChartOpen");
    let position = 0;

    title.textContent = labels[key] || "Composição do mês";
    totalLabel.textContent = context.formatMoney(total);
    pie.style.backgroundImage = total
      ? `conic-gradient(${items.map((item, index) => {
        const start = position;
        position += item.value / total * 100;
        return `${colors[index % colors.length]} ${start}% ${position}%`;
      }).join(",")})`
      : "conic-gradient(#292929 0 100%)";
    pie.setAttribute("aria-label", total
      ? `${labels[key]}. Total ${context.formatMoney(total)}`
      : `${labels[key]}. Sem valores registrados neste mês.`);

    legend.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("li");
      const marker = document.createElement("i");
      const label = document.createElement("span");
      const value = document.createElement("b");
      marker.style.backgroundColor = colors[index % colors.length];
      marker.setAttribute("aria-hidden", "true");
      label.textContent = item.label;
      value.textContent = `${context.formatMoney(item.value)} · ${Math.round(item.value / total * 100)}%`;
      row.append(marker, label, value);
      legend.append(row);
    });
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "dashboard-chart-empty";
      empty.textContent = "Nenhum valor registrado neste mês.";
      legend.append(empty);
    }
    note.textContent = `Valores registrados em ${context.getMonth()}.`;
    route.dataset.chartPage = card.dataset.chartPage || "stats";
  }

  function show(card, lockOpen = false) {
    clearTimeout(hideTimer);
    render(card);
    const popover = document.querySelector("#dashboardChartPopover");
    popover.hidden = false;
    pinned = lockOpen;
    popover.classList.toggle("pinned", pinned);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    if (!pinned) hideTimer = setTimeout(() => {
      const popover = document.querySelector("#dashboardChartPopover");
      popover.hidden = true;
      popover.classList.remove("pinned");
    }, 900);
  }

  function close() {
    clearTimeout(hideTimer);
    document.querySelector("#dashboardChartPopover").hidden = true;
    document.querySelector("#dashboardChartPopover").classList.remove("pinned");
    pinned = false;
    document.querySelector("#dashboardPieTotal").textContent = context.formatMoney(0);
    document.querySelector("#dashboardChartLegend").replaceChildren();
    document.querySelector("#dashboardChartTitle").textContent = "Comparação";
    document.querySelector("#dashboardPie").style.backgroundImage = "conic-gradient(#292929 0 100%)";
    document.querySelector("#dashboardPie").setAttribute("aria-label", "Gráfico de composição");
    document.querySelector("#dashboardChartNote").textContent = "";
  }

  function bind(options) {
    if (context) return;
    context = options;
    document.querySelectorAll("[data-dashboard-chart]").forEach(card => {
      card.addEventListener("pointerenter", event => {
        if (event.pointerType !== "touch") show(card);
      });
      card.addEventListener("pointerleave", scheduleHide);
      card.addEventListener("focus", () => show(card));
      card.addEventListener("click", () => show(card, true));
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          show(card, true);
        }
      });
    });

    const popover = document.querySelector("#dashboardChartPopover");
    popover.addEventListener("pointerenter", () => clearTimeout(hideTimer));
    popover.addEventListener("pointerleave", scheduleHide);
    document.querySelector("#dashboardChartClose").addEventListener("click", close);
    document.querySelector("#dashboardChartOpen").addEventListener("click", event => {
      const page = event.currentTarget.dataset.chartPage;
      close();
      context.openPage(page);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
    document.addEventListener("click", event => {
      if (pinned && !event.target.closest("[data-dashboard-chart], #dashboardChartPopover")) close();
    });
  }

  function refresh() {
    if (!pinned) return;
    const key = document.querySelector("#dashboardChartTitle").textContent;
    const card = [...document.querySelectorAll("[data-dashboard-chart]")]
      .find(item => labels[item.dataset.dashboardChart] === key);
    if (card) render(card);
  }

  window.NexusDashboardCharts = { bind, close, refresh };
})();
