const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imgCounter = document.getElementById("img-counter");
const labelInput = document.getElementById("label-input");
const labelDatalist = document.getElementById("label-list");
const labelUl = document.getElementById("label-list-ul");
const boxUl = document.getElementById("box-list");
const toast = document.getElementById("toast");
const emptyMsg = document.getElementById("empty-msg");

let state = { images: [], annotations: {}, labels: [] };
let current = 0;
let activeLabel = null;
let boxes = [];
let drawing = false;
let startX = 0, startY = 0;
let selBox = -1;
let img = null;
let nextBoxId = 1;

function showToast(msg, err = false) {
  toast.textContent = msg;
  toast.className = "toast" + (err ? " error" : "");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.className = "toast hidden"), 2500);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

async function loadState() {
  const r = await fetch("/api/state");
  state = await r.json();
  renderLabels();
  if (state.images.length === 0) {
    emptyMsg.classList.remove("hidden");
    canvas.classList.add("hidden");
    imgCounter.textContent = "0 ảnh";
    return;
  }
  emptyMsg.classList.add("hidden");
  canvas.classList.remove("hidden");
  current = Math.min(current, state.images.length - 1);
  await openImage(current);
}

function renderLabels() {
  labelDatalist.innerHTML = state.labels.map((l) => `<option value="${esc(l)}">`).join("");
  labelUl.innerHTML = state.labels
    .map(
      (l) =>
        `<li class="${l === activeLabel ? "active" : ""}" data-label="${esc(l)}">${esc(l)}</li>`
    )
    .join("");
  labelUl.querySelectorAll("li").forEach((li) => {
    li.onclick = () => {
      activeLabel = li.dataset.label;
      labelInput.value = activeLabel;
      renderLabels();
    };
  });
}

function renderBoxes() {
  boxUl.innerHTML = boxes
    .map(
      (b, i) =>
        `<li class="${i === selBox ? "selected" : ""}" data-i="${i}">
          <span>${esc(b.label)} <small class="muted">(${b.bbox.join(",")})</small></span>
          <button class="box-del" data-del="${i}" title="Xóa">×</button>
        </li>`
    )
    .join("");
  boxUl.querySelectorAll("li").forEach((li) => {
    li.onclick = (e) => {
      if (e.target.dataset.del !== undefined) return;
      selBox = +li.dataset.i;
      renderBoxes();
      draw();
    };
  });
  boxUl.querySelectorAll(".box-del").forEach((btn) => {
    btn.onclick = () => {
      boxes.splice(+btn.dataset.del, 1);
      selBox = -1;
      renderBoxes();
      draw();
      save();
    };
  });
}

async function openImage(i) {
  current = i;
  const fname = state.images[i];
  imgCounter.textContent = `${i + 1}/${state.images.length} · ${fname}`;
  boxes = (state.annotations[fname] || []).map((b) => ({ ...b }));
  selBox = -1;
  boxes.forEach((b) => {
    if (b.id >= nextBoxId) nextBoxId = b.id + 1;
  });

  img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    draw();
    renderBoxes();
  };
  img.src = "/images/" + encodeURIComponent(fname);
}

function draw() {
  if (!img) return;
  ctx.drawImage(img, 0, 0);
  boxes.forEach((b, i) => {
    const [x, y, w, h] = b.bbox;
    ctx.lineWidth = i === selBox ? 4 : 2;
    ctx.strokeStyle = i === selBox ? "#ff5f5f" : "#4f8cff";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = i === selBox ? "#ff5f5f" : "#4f8cff";
    ctx.font = "14px sans-serif";
    const label = b.label || "?";
    const tw = ctx.measureText(label).width + 8;
    ctx.fillRect(x, Math.max(0, y - 18), tw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 4, Math.max(14, y - 4));
  });
  if (drawing) {
    // preview sẽ draw trong mousemove
  }
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener("mousedown", (e) => {
  if (!activeLabel) {
    showToast("Chọn/nhập nhãn trước khi vẽ!", true);
    return;
  }
  drawing = true;
  const p = canvasPos(e);
  startX = p.x;
  startY = p.y;
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const p = canvasPos(e);
  draw();
  ctx.strokeStyle = "#4f8cff";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
  ctx.setLineDash([]);
});

canvas.addEventListener("mouseup", (e) => {
  if (!drawing) return;
  drawing = false;
  const p = canvasPos(e);
  const x = Math.min(startX, p.x);
  const y = Math.min(startY, p.y);
  const w = Math.abs(p.x - startX);
  const h = Math.abs(p.y - startY);
  if (w < 4 || h < 4) {
    draw();
    return;
  }
  boxes.push({ id: nextBoxId++, label: activeLabel, bbox: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)] });
  renderBoxes();
  draw();
  save();
});

async function save() {
  const fname = state.images[current];
  if (!fname) return;
  const r = await fetch("/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: fname, boxes }),
  });
  const d = await r.json();
  if (d.ok) {
    state.labels = d.labels;
    state.annotations[fname] = boxes;
    renderLabels();
  }
}

document.getElementById("label-form").onsubmit = (e) => {
  e.preventDefault();
  const v = labelInput.value.trim();
  if (!v) return;
  if (!state.labels.includes(v)) state.labels.push(v);
  activeLabel = v;
  renderLabels();
  labelInput.value = "";
};

document.getElementById("btn-prev").onclick = () => {
  if (current > 0) openImage(current - 1);
};
document.getElementById("btn-next").onclick = () => {
  if (current < state.images.length - 1) openImage(current + 1);
};
document.getElementById("btn-save").onclick = async () => {
  await save();
  showToast("Đã lưu ✓");
};

async function exportFmt(fmt) {
  const r = await fetch("/api/export/" + fmt, { method: "POST" });
  const d = await r.json();
  if (d.ok) showToast(`Export ${fmt.toUpperCase()} ✓ (${d.boxes} box) → ${d.dir || d.file}`);
  else showToast(d.error || "Lỗi export", true);
}
document.getElementById("btn-export-yolo").onclick = () => exportFmt("yolo");
document.getElementById("btn-export-coco").onclick = () => exportFmt("coco");

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "ArrowLeft") document.getElementById("btn-prev").click();
  if (e.key === "ArrowRight") document.getElementById("btn-next").click();
  if (e.key === "Delete" && selBox >= 0) {
    boxes.splice(selBox, 1);
    selBox = -1;
    renderBoxes();
    draw();
    save();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    document.getElementById("btn-save").click();
  }
});

loadState();
