(function () {
  const HIT = 9;
  const ZONE_COLORS = {
    forest: 'rgba(31, 90, 40, 0.45)',
    meadow: 'rgba(120, 190, 80, 0.45)',
    field: 'rgba(200, 170, 90, 0.5)',
    water: 'rgba(60, 130, 200, 0.55)',
    village: 'rgba(200, 120, 90, 0.45)',
  };
  const POI_LABELS = { spectators: 'Публика', bridge: 'Мост', jump: 'Скок' };

  function parse(text) {
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.points)) {
        return {
          aspect: data.aspect || 16 / 9,
          points: data.points,
          labels: data.labels || [],
          zones: data.zones || [],
          rivers: data.rivers || [],
          pois: data.pois || [],
        };
      }
    } catch (e) {}
    return { aspect: 16 / 9, points: [], labels: [], zones: [], rivers: [], pois: [] };
  }

  function inside(px, py, polygon) {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) result = !result;
    }
    return result;
  }

  function init(root) {
    const input = root.querySelector('textarea');
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const file = root.querySelector('input[type=file]');
    const count = root.querySelector('.bgr-route-count');
    const zoneType = root.querySelector('[data-role=zone-type]');
    const poiType = root.querySelector('[data-role=poi-type]');
    const data = parse(input.value);
    let image = null;
    let mode = 'point';
    let current = [];
    let drag = null;
    let moved = false;

    const px = (x, y) => [x * canvas.width, y * canvas.height];

    function size() {
      const width = Math.min(root.clientWidth || 900, 1000);
      canvas.width = width;
      canvas.height = Math.round(width / data.aspect);
    }

    function fromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      return [
        Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      ];
    }

    function near(nx, ny, x, y, extra = 0) {
      const [ax, ay] = px(nx, ny);
      const [bx, by] = px(x, y);
      return Math.hypot(ax - bx, ay - by) <= HIT + extra;
    }

    function hit(nx, ny) {
      for (let i = data.points.length - 1; i >= 0; i--) {
        if (near(nx, ny, data.points[i][0], data.points[i][1])) return { kind: 'point', index: i };
      }
      for (let i = data.labels.length - 1; i >= 0; i--) {
        if (near(nx, ny, data.labels[i].x, data.labels[i].y, 4)) return { kind: 'label', index: i };
      }
      for (let i = data.pois.length - 1; i >= 0; i--) {
        if (near(nx, ny, data.pois[i].x, data.pois[i].y, 4)) return { kind: 'poi', index: i };
      }
      return null;
    }

    function sync() {
      const round = (v) => Math.round(v * 10000) / 10000;
      const line = (list) => list.map(([x, y]) => [round(x), round(y)]);
      input.value = data.points.length
        ? JSON.stringify({
            aspect: round(data.aspect),
            points: line(data.points),
            labels: data.labels.map((l) => ({ name: l.name, x: round(l.x), y: round(l.y) })),
            zones: data.zones.map((z) => ({ type: z.type, points: line(z.points) })),
            rivers: data.rivers.map((r) => ({ points: line(r.points) })),
            pois: data.pois.map((p) => ({ type: p.type, x: round(p.x), y: round(p.y) })),
          })
        : '';
      count.textContent = `${data.points.length} точки · ${data.labels.length} надписа · ${data.zones.length} зони · ${data.rivers.length} реки · ${data.pois.length} обекта`;
    }

    function polyline(list, color, width, close) {
      if (list.length < 2) return;
      ctx.beginPath();
      list.forEach(([x, y], i) => {
        const [cx, cy] = px(x, y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      if (close) ctx.closePath();
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.strokeStyle = '#dcdcde';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }

      data.zones.forEach((zone) => {
        ctx.beginPath();
        zone.points.forEach(([x, y], i) => {
          const [cx, cy] = px(x, y);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
        ctx.fillStyle = ZONE_COLORS[zone.type] || 'rgba(0,0,0,0.2)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();
      });
      data.rivers.forEach((river) => polyline(river.points, 'rgba(40, 110, 200, 0.9)', 4, false));

      if (current.length) {
        polyline(current, mode === 'river' ? '#1e6fd9' : '#7a1fa2', 2, false);
        current.forEach(([x, y]) => {
          const [cx, cy] = px(x, y);
          ctx.fillStyle = '#7a1fa2';
          ctx.fillRect(cx - 3, cy - 3, 6, 6);
        });
      }

      if (data.points.length) {
        ctx.lineJoin = 'round';
        polyline(data.points, 'rgba(230, 57, 70, 0.9)', 5, false);
        data.points.forEach(([x, y], i) => {
          const [cx, cy] = px(x, y);
          const end = i === 0 || i === data.points.length - 1;
          ctx.fillStyle = i === 0 ? '#2ea043' : i === data.points.length - 1 ? '#111' : '#fff';
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, end ? 7 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      data.pois.forEach((poi) => {
        const [cx, cy] = px(poi.x, poi.y);
        ctx.fillStyle = poi.type === 'jump' ? '#f0b400' : poi.type === 'bridge' ? '#6b4f2a' : '#d63384';
        ctx.fillRect(cx - 6, cy - 6, 12, 12);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(POI_LABELS[poi.type], cx, cy - 10);
        ctx.fillStyle = '#1d2327';
        ctx.fillText(POI_LABELS[poi.type], cx, cy - 10);
      });

      ctx.font = 'bold 13px sans-serif';
      data.labels.forEach((label) => {
        const [cx, cy] = px(label.x, label.y);
        ctx.fillStyle = '#2271b1';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(label.name, cx, cy - 9);
        ctx.fillStyle = '#1d2327';
        ctx.fillText(label.name, cx, cy - 9);
      });
    }

    function finishShape() {
      if (mode === 'zone' && current.length >= 3) {
        data.zones.push({ type: zoneType.value, points: current });
      } else if (mode === 'river' && current.length >= 2) {
        data.rivers.push({ points: current });
      }
      current = [];
      draw();
      sync();
    }

    function setMode(next) {
      if (current.length) finishShape();
      mode = next;
      root.querySelectorAll('[data-mode]').forEach((button) => {
        button.classList.toggle('button-primary', button.dataset.mode === mode);
      });
    }

    file.addEventListener('change', () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          image = img;
          data.aspect = img.width / img.height;
          size();
          draw();
          sync();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(chosen);
    });

    root.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
    root.querySelector('[data-action=finish]').addEventListener('click', finishShape);
    root.querySelector('[data-action=undo]').addEventListener('click', () => {
      data.points.pop();
      draw();
      sync();
    });
    root.querySelector('[data-action=clear]').addEventListener('click', () => {
      if (window.confirm('Да изчистя ли пътя, надписите, зоните, реките и обектите?')) {
        Object.assign(data, { points: [], labels: [], zones: [], rivers: [], pois: [] });
        current = [];
        draw();
        sync();
      }
    });

    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      const [nx, ny] = fromEvent(event);
      drag = mode === 'point' || mode === 'label' || mode === 'poi' ? hit(nx, ny) : null;
      moved = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      if (!drag) return;
      const [nx, ny] = fromEvent(event);
      moved = true;
      if (drag.kind === 'point') data.points[drag.index] = [nx, ny];
      else if (drag.kind === 'label') Object.assign(data.labels[drag.index], { x: nx, y: ny });
      else Object.assign(data.pois[drag.index], { x: nx, y: ny });
      draw();
    });

    window.addEventListener('mouseup', (event) => {
      if (event.target !== canvas && !drag) return;
      const wasDrag = drag && moved;
      if (event.target === canvas && event.button === 0 && !wasDrag && !drag) {
        const [nx, ny] = fromEvent(event);
        if (mode === 'point') {
          data.points.push([nx, ny]);
        } else if (mode === 'label') {
          const name = window.prompt('Име на мястото (село, връх, мост...)');
          if (name) data.labels.push({ name: name.trim(), x: nx, y: ny });
        } else if (mode === 'poi') {
          data.pois.push({ type: poiType.value, x: nx, y: ny });
        } else {
          current.push([nx, ny]);
        }
        draw();
      }
      drag = null;
      sync();
    });

    canvas.addEventListener('dblclick', (event) => {
      if (mode === 'zone' || mode === 'river') {
        event.preventDefault();
        current.pop();
        finishShape();
      }
    });

    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (current.length) {
        current.pop();
        draw();
        return;
      }
      const [nx, ny] = fromEvent(event);
      const target = hit(nx, ny);
      if (target) {
        const list = target.kind === 'point' ? data.points : target.kind === 'label' ? data.labels : data.pois;
        list.splice(target.index, 1);
      } else {
        const river = data.rivers.findIndex((r) => r.points.some(([x, y]) => near(nx, ny, x, y, 4)));
        if (river >= 0) {
          data.rivers.splice(river, 1);
        } else {
          for (let i = data.zones.length - 1; i >= 0; i--) {
            if (inside(nx, ny, data.zones[i].points)) {
              data.zones.splice(i, 1);
              break;
            }
          }
        }
      }
      draw();
      sync();
    });

    size();
    draw();
    sync();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.bgr-route-editor').forEach(init);
  });
})();
