(function () {
  "use strict";

  const els = {
    micBtn: document.getElementById("btn-mic"),
    micIcon: document.getElementById("mic-icon"),
    micStatus: document.getElementById("mic-status"),
    transcriptLive: document.getElementById("transcript-live"),
    micUnsupported: document.getElementById("mic-unsupported"),

    manualText: document.getElementById("f-manual-text"),
    btnInterpretar: document.getElementById("btn-interpretar"),
    btnManualBlank: document.getElementById("btn-manual-blank"),

    confirm: document.getElementById("confirm"),
    confirmOrigem: document.getElementById("confirm-origem"),
    fData: document.getElementById("f-data"),
    fMaquina: document.getElementById("f-maquina"),
    fSetor: document.getElementById("f-setor"),
    fInicio: document.getElementById("f-inicio"),
    fFim: document.getElementById("f-fim"),
    fDuracaoDisplay: document.getElementById("f-duracao-display"),
    fDescricao: document.getElementById("f-descricao"),
    btnSalvar: document.getElementById("btn-salvar"),
    btnCancelar: document.getElementById("btn-cancelar"),

    dataLista: document.getElementById("f-data-lista"),
    btnPrevDay: document.getElementById("btn-prev-day"),
    btnNextDay: document.getElementById("btn-next-day"),
    totalDia: document.getElementById("total-dia"),
    lista: document.getElementById("lista-atendimentos"),
    listaVazia: document.getElementById("lista-vazia"),
    btnCopiar: document.getElementById("btn-copiar"),
    btnPdf: document.getElementById("btn-pdf"),
    btnBaixar: document.getElementById("btn-baixar"),

    toast: document.getElementById("toast"),
    clipboardFallback: document.getElementById("clipboard-fallback")
  };

  let editingId = null;
  let currentOriginTranscript = "";

  // ---------- datas ----------

  function toDateInputValue(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return toDateInputValue(d);
  }

  function formatDateBR(dateStr) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // ---------- storage ----------

  function storageKey(dateStr) {
    return "relatorio_atendimentos_" + dateStr;
  }

  function loadEntries(dateStr) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(dateStr)) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveEntries(dateStr, entries) {
    localStorage.setItem(storageKey(dateStr), JSON.stringify(entries));
  }

  function removeEntryFromDate(dateStr, id) {
    const entries = loadEntries(dateStr).filter(e => e.id !== id);
    saveEntries(dateStr, entries);
  }

  function genId() {
    return "e_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- toast ----------

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
  }

  // ---------- reconhecimento de voz ----------

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  if (SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listening = true;
      els.micBtn.classList.add("listening");
      els.micStatus.textContent = "Ouvindo... toque novamente para parar";
      els.transcriptLive.hidden = false;
      els.transcriptLive.textContent = "";
    };

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      els.transcriptLive.textContent = finalTranscript || interim;
    };

    recognition.onerror = (event) => {
      listening = false;
      els.micBtn.classList.remove("listening");
      if (event.error === "no-speech") {
        els.micStatus.textContent = "Não ouvi nada. Toque no microfone e fale.";
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        els.micStatus.textContent = "Permissão de microfone negada.";
      } else {
        els.micStatus.textContent = "Erro no reconhecimento de voz. Tente novamente.";
      }
    };

    recognition.onend = () => {
      listening = false;
      els.micBtn.classList.remove("listening");
      els.micStatus.textContent = "Toque no microfone e fale o atendimento";
      const text = finalTranscript.trim();
      finalTranscript = "";
      if (text) {
        handleTranscript(text, "voz");
      }
    };

    els.micBtn.addEventListener("click", () => {
      if (listening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          // recognition already active; ignore
        }
      }
    });
  } else {
    els.micBtn.disabled = true;
    els.micUnsupported.hidden = false;
  }

  // ---------- fallback manual ----------

  els.btnInterpretar.addEventListener("click", () => {
    const text = els.manualText.value.trim();
    if (!text) return;
    handleTranscript(text, "texto");
  });

  els.btnManualBlank.addEventListener("click", () => {
    openConfirmForm({
      maquina: "",
      setor: "",
      inicio: minutesToHHMM(new Date().getHours() * 60 + new Date().getMinutes()),
      fim: minutesToHHMM(new Date().getHours() * 60 + new Date().getMinutes()),
      duracaoMin: 0,
      descricao: "",
      dateOffsetDays: 0
    }, "manual", "");
  });

  // ---------- confirmação ----------

  function handleTranscript(text, origem) {
    const parsed = parseReport(text, new Date());
    openConfirmForm(parsed, origem, text);
  }

  function openConfirmForm(parsed, origem, originalText) {
    editingId = null;
    currentOriginTranscript = originalText || "";

    let baseDate = els.dataLista.value || toDateInputValue(new Date());
    if (parsed.dateOffsetDays) baseDate = addDays(baseDate, parsed.dateOffsetDays);

    els.fData.value = baseDate;
    els.fMaquina.value = parsed.maquina || "";
    els.fSetor.value = parsed.setor || "";
    els.fInicio.value = parsed.inicio;
    els.fFim.value = parsed.fim;
    els.fDescricao.value = parsed.descricao || "";
    updateDuracaoDisplay();

    els.confirmOrigem.textContent = origem === "voz"
      ? "Reconhecido por voz — confira antes de salvar"
      : origem === "texto"
        ? "Interpretado do texto digitado"
        : "Novo atendimento manual";

    els.confirm.hidden = false;
    els.confirm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateDuracaoDisplay() {
    const i = hhmmToMinutes(els.fInicio.value);
    const f = hhmmToMinutes(els.fFim.value);
    if (i == null || f == null) {
      els.fDuracaoDisplay.textContent = "--";
      return;
    }
    let dur = f - i;
    if (dur < 0) dur += 1440;
    els.fDuracaoDisplay.textContent = formatDuration(dur);
  }

  els.fInicio.addEventListener("change", updateDuracaoDisplay);
  els.fFim.addEventListener("change", updateDuracaoDisplay);

  els.btnCancelar.addEventListener("click", closeConfirmForm);

  function closeConfirmForm() {
    els.confirm.hidden = true;
    editingId = null;
    currentOriginTranscript = "";
    els.manualText.value = "";
    els.transcriptLive.hidden = true;
  }

  els.btnSalvar.addEventListener("click", () => {
    const date = els.fData.value || toDateInputValue(new Date());
    const inicio = els.fInicio.value;
    const fim = els.fFim.value;
    if (!inicio || !fim) {
      showToast("Preencha início e fim");
      return;
    }
    let dur = hhmmToMinutes(fim) - hhmmToMinutes(inicio);
    if (dur < 0) dur += 1440;

    const entry = {
      id: editingId || genId(),
      maquina: els.fMaquina.value.trim(),
      setor: els.fSetor.value.trim(),
      inicio,
      fim,
      duracaoMin: dur,
      descricao: els.fDescricao.value.trim(),
      transcricaoOriginal: currentOriginTranscript,
      criadoEm: Date.now()
    };

    if (editingId) {
      removeEntryFromDate(els.dataLista.value, editingId);
    }

    const entries = loadEntries(date);
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx !== -1) entries[idx] = entry;
    else entries.push(entry);
    entries.sort((a, b) => a.inicio.localeCompare(b.inicio));
    saveEntries(date, entries);

    els.dataLista.value = date;
    closeConfirmForm();
    renderList();
    showToast("Atendimento salvo");
  });

  // ---------- edição / exclusão ----------

  function editEntry(id) {
    const date = els.dataLista.value;
    const entry = loadEntries(date).find(e => e.id === id);
    if (!entry) return;
    editingId = id;
    currentOriginTranscript = entry.transcricaoOriginal || "";

    els.fData.value = date;
    els.fMaquina.value = entry.maquina || "";
    els.fSetor.value = entry.setor || "";
    els.fInicio.value = entry.inicio;
    els.fFim.value = entry.fim;
    els.fDescricao.value = entry.descricao || "";
    updateDuracaoDisplay();

    els.confirmOrigem.textContent = "Editando atendimento";
    els.confirm.hidden = false;
    els.confirm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteEntry(id) {
    if (!confirm("Excluir este atendimento?")) return;
    removeEntryFromDate(els.dataLista.value, id);
    renderList();
    showToast("Atendimento excluído");
  }

  // ---------- lista ----------

  function renderList() {
    const date = els.dataLista.value;
    const entries = loadEntries(date);

    els.lista.innerHTML = "";
    els.listaVazia.hidden = entries.length > 0;

    let total = 0;
    for (const entry of entries) {
      total += entry.duracaoMin;
      const li = document.createElement("li");
      li.className = "entry-card";
      const local = [entry.maquina, entry.setor].filter(Boolean).join(" — ");
      li.innerHTML = `
        <div class="entry-top">
          <span class="entry-time">${entry.inicio} – ${entry.fim}</span>
          <span class="entry-dur">${formatDuration(entry.duracaoMin)}</span>
        </div>
        ${local ? `<div class="entry-setor">${escapeHtml(local)}</div>` : ""}
        ${entry.descricao ? `<div class="entry-desc">${escapeHtml(entry.descricao)}</div>` : ""}
        <div class="entry-actions">
          <button data-action="edit" data-id="${entry.id}">Editar</button>
          <button data-action="delete" data-id="${entry.id}" class="delete">Excluir</button>
        </div>
      `;
      els.lista.appendChild(li);
    }

    els.totalDia.textContent = formatDuration(total);
  }

  els.lista.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit") editEntry(id);
    else if (btn.dataset.action === "delete") deleteEntry(id);
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- navegação de data ----------

  els.dataLista.addEventListener("change", renderList);

  els.btnPrevDay.addEventListener("click", () => {
    els.dataLista.value = addDays(els.dataLista.value, -1);
    renderList();
  });

  els.btnNextDay.addEventListener("click", () => {
    els.dataLista.value = addDays(els.dataLista.value, 1);
    renderList();
  });

  // ---------- exportação ----------

  function entryLocationLabel(entry) {
    return [entry.maquina, entry.setor].filter(Boolean).join(" — ") || "Local não informado";
  }

  function buildReportText() {
    const date = els.dataLista.value;
    const entries = loadEntries(date);
    let total = 0;
    const lines = [`Relatório de atendimentos — ${formatDateBR(date)}`, ""];
    for (const entry of entries) {
      total += entry.duracaoMin;
      lines.push(`${entry.inicio} às ${entry.fim} (${formatDuration(entry.duracaoMin)}) — ${entryLocationLabel(entry)}`);
      if (entry.descricao) lines.push(entry.descricao);
      lines.push("");
    }
    lines.push(`Total do dia: ${formatDuration(total)}`);
    return lines.join("\n");
  }

  els.btnCopiar.addEventListener("click", async () => {
    const text = buildReportText();
    try {
      await navigator.clipboard.writeText(text);
      showToast("Relatório copiado!");
    } catch (e) {
      els.clipboardFallback.value = text;
      els.clipboardFallback.hidden = false;
      els.clipboardFallback.select();
      try {
        document.execCommand("copy");
        showToast("Relatório copiado!");
      } catch (e2) {
        showToast("Não foi possível copiar automaticamente");
      }
      els.clipboardFallback.hidden = true;
    }
  });

  els.btnPdf.addEventListener("click", () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast("PDF indisponível neste navegador");
      return;
    }
    const { jsPDF } = window.jspdf;
    const date = els.dataLista.value;
    const entries = loadEntries(date);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - marginX * 2;
    let y = 20;

    function ensureSpace(extraLines) {
      const needed = extraLines * 5.5 + 6;
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Atendimentos", marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(formatDateBR(date), marginX, y);
    y += 10;

    let total = 0;
    if (entries.length === 0) {
      doc.text("Nenhum atendimento lançado neste dia.", marginX, y);
      y += 8;
    }

    for (const entry of entries) {
      total += entry.duracaoMin;
      const header = `${entry.inicio} - ${entry.fim}  (${formatDuration(entry.duracaoMin)})`;
      const local = entryLocationLabel(entry);
      const descLines = entry.descricao ? doc.splitTextToSize(entry.descricao, maxWidth) : [];

      ensureSpace(3 + descLines.length);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(header, marginX, y);
      y += 5.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(local, marginX, y);
      y += 5.5;

      if (descLines.length) {
        doc.setFontSize(10);
        doc.text(descLines, marginX, y);
        y += descLines.length * 4.6;
      }
      y += 4;

      doc.setDrawColor(210);
      doc.line(marginX, y - 2, pageWidth - marginX, y - 2);
    }

    ensureSpace(2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total do dia: ${formatDuration(total)}`, marginX, y + 3);

    doc.save(`relatorio-${date}.pdf`);
  });

  els.btnBaixar.addEventListener("click", () => {
    const date = els.dataLista.value;
    const text = buildReportText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------- init ----------

  els.dataLista.value = toDateInputValue(new Date());
  renderList();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
