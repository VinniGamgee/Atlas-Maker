/* Balatro Atlas Generator - Capacitor + Web */
(function () {
  'use strict';

  var images = [];
  var atlasBlob = null;
  var atlasDataUrl = null;

  var fullCanvas = null;
  var fullCtx = null;
  var fullW = 0, fullH = 0;
  var simpleMode = false;
  var lastRemoverDataUrl = null;
  var undoStack = [];
  var MAX_UNDO = 15;

  function hasCapacitor() {
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  }

  function capPlugins() {
    if (!window.Capacitor || !window.Capacitor.Plugins) return null;
    return window.Capacitor.Plugins;
  }

  function log() {
    try { console.log.apply(console, arguments); } catch (e) {}
  }

  // ========== TABS ==========
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.getAttribute('data-tab')).classList.add('active');
      if (btn.getAttribute('data-tab') === 'gallery') renderGallery();
    });
  });

  function setAtlasStatus(msg) {
    var el = document.getElementById('atlasStatus');
    if (el) el.textContent = msg || '';
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result || '';
        var b64 = result.indexOf(',') >= 0 ? result.split(',')[1] : result;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ========== SAVE (Capacitor Filesystem + Share prioritário) ==========
  function saveBlob(blob, filename) {
    if (!blob) {
      alert('Nada para salvar.');
      return;
    }
    setAtlasStatus('Salvando ' + filename + '…');

    // Capacitor nativo
    if (hasCapacitor()) {
      saveWithCapacitor(blob, filename).catch(function (err) {
        log('Capacitor save error', err);
        setAtlasStatus('Erro Capacitor: ' + (err && err.message ? err.message : err));
        // fallback
        tryWebShare(blob, filename) || fallbackDownload(blob, filename);
      });
      return;
    }

    // Browser / WebView sem Capacitor
    if (tryWebShare(blob, filename)) return;
    fallbackDownload(blob, filename);
  }

  async function saveWithCapacitor(blob, filename) {
    var Plugins = capPlugins();
    if (!Plugins) throw new Error('Plugins Capacitor não encontrados. Rode npx cap sync.');

    var base64 = await blobToBase64(blob);
    var Filesystem = Plugins.Filesystem;
    var Share = Plugins.Share;

    if (!Filesystem || !Filesystem.writeFile) {
      throw new Error('Plugin Filesystem ausente. Instale @capacitor/filesystem');
    }

    // Diretórios possíveis (Capacitor Directory enum como string)
    var dirs = ['DOCUMENTS', 'DATA', 'CACHE', 'EXTERNAL', 'EXTERNAL_STORAGE'];
    var lastErr = null;
    var written = null;

    for (var i = 0; i < dirs.length; i++) {
      try {
        var result = await Filesystem.writeFile({
          path: 'BalatroAtlas/' + filename,
          data: base64,
          directory: dirs[i],
          recursive: true
        });
        written = { uri: result.uri, directory: dirs[i] };
        log('Escrito em', dirs[i], result.uri);
        break;
      } catch (e) {
        lastErr = e;
        // tenta sem subpasta
        try {
          var result2 = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: dirs[i],
            recursive: true
          });
          written = { uri: result2.uri, directory: dirs[i] };
          break;
        } catch (e2) {
          lastErr = e2;
        }
      }
    }

    if (!written) {
      throw lastErr || new Error('Não foi possível gravar em nenhum diretório');
    }

    setAtlasStatus('Salvo em ' + written.directory + ': ' + filename);

    // Oferece compartilhar (usuário pode mandar p/ Downloads / Galeria)
    if (Share && Share.share) {
      try {
        await Share.share({
          title: filename,
          text: 'Balatro Atlas',
          url: written.uri,
          dialogTitle: 'Salvar ou compartilhar PNG'
        });
      } catch (shareErr) {
        // usuário cancelou — ok
        log('share', shareErr);
      }
    }

    alert('Arquivo salvo!\n\nLocal: ' + written.directory + '\n' + (written.uri || filename) +
      '\n\nSe não achar, use o menu Compartilhar que abriu (Salvar em Arquivos/Downloads).');
  }

  function tryWebShare(blob, filename) {
    try {
      if (!navigator.share || !navigator.canShare) return false;
      var file = new File([blob], filename, { type: blob.type || 'image/png' });
      if (!navigator.canShare({ files: [file] })) return false;
      navigator.share({ files: [file], title: filename, text: 'Balatro Atlas' })
        .then(function () { setAtlasStatus('Compartilhado: ' + filename); })
        .catch(function () { fallbackDownload(blob, filename); });
      return true;
    } catch (e) {
      return false;
    }
  }

  function fallbackDownload(blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 2000);
      setAtlasStatus('Download: ' + filename);
    } catch (e) {
      var reader = new FileReader();
      reader.onload = function () {
        if (confirm('Abrir imagem para salvar manualmente?')) {
          var w = window.open();
          if (w) {
            w.document.write('<html><body style="margin:0;background:#111;text-align:center">' +
              '<img src="' + reader.result + '" style="max-width:100%"/>' +
              '<p style="color:#fff">Segure a imagem → Salvar</p></body></html>');
          }
        }
      };
      reader.readAsDataURL(blob);
    }
  }

  // ========== ATLAS ==========
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('fileInput');

  dropzone.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });

  function handleFiles(files) {
    // Mantém a ordem do FileList (ordem de seleção no desktop;
    // no Android a galeria às vezes entrega por nome/data — use "Ordenar por nome").
    var list = [];
    Array.prototype.forEach.call(files, function (file) {
      if (file.type && file.type.indexOf('image/') === 0) list.push(file);
    });
    if (!list.length) return;

    var startIndex = images.length;
    var pending = list.length;
    // Reserva slots na ordem correta para não embaralhar com onload assíncrono
    for (var s = 0; s < list.length; s++) {
      images.push(null);
    }

    list.forEach(function (file, i) {
      var slot = startIndex + i;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          images[slot] = {
            id: Date.now() + Math.random() + i * 0.001,
            name: file.name,
            img: img,
            dataUrl: ev.target.result,
            order: slot
          };
          pending--;
          if (pending <= 0) {
            // remove eventuais nulls se algum falhou
            images = images.filter(function (x) { return x; });
            renderThumbs();
            updateAtlasButtons();
          } else {
            // atualiza preview parcial só dos que já chegaram, na ordem
            renderThumbs();
            updateAtlasButtons();
          }
        };
        img.onerror = function () {
          images[slot] = null;
          pending--;
          if (pending <= 0) {
            images = images.filter(function (x) { return x; });
          }
          renderThumbs();
          updateAtlasButtons();
        };
        img.src = ev.target.result;
      };
      reader.onerror = function () {
        images[slot] = null;
        pending--;
        if (pending <= 0) images = images.filter(function (x) { return x; });
        renderThumbs();
        updateAtlasButtons();
      };
      reader.readAsDataURL(file);
    });
  }

  /** Ordenação natural: img2 antes de img10 */
  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function sortImagesByName() {
    images.sort(function (a, b) {
      return naturalCompare(a.name || '', b.name || '');
    });
    renderThumbs();
    updateAtlasButtons();
    setAtlasStatus('Ordenado por nome (natural): ' + images.length + ' imagens');
  }

  function moveImage(idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= images.length) return;
    var t = images[idx];
    images[idx] = images[j];
    images[j] = t;
    renderThumbs();
  }

  function renderThumbs() {
    var container = document.getElementById('thumbs');
    container.innerHTML = '';
    images.forEach(function (item, idx) {
      if (!item) return;
      var div = document.createElement('div');
      div.className = 'thumb';
      div.innerHTML =
        '<button type="button" class="remove" title="Remover">×</button>' +
        '<img src="' + item.dataUrl + '" alt="">' +
        '<div class="name">' + (idx + 1) + '. ' + item.name + '</div>' +
        '<div class="thumb-order">' +
        '<button type="button" class="btn-up" title="Subir">▲</button>' +
        '<button type="button" class="btn-down" title="Descer">▼</button>' +
        '</div>';
      div.querySelector('.remove').onclick = function () {
        images.splice(idx, 1);
        renderThumbs();
        updateAtlasButtons();
      };
      div.querySelector('.btn-up').onclick = function (e) {
        e.stopPropagation();
        moveImage(idx, -1);
      };
      div.querySelector('.btn-down').onclick = function (e) {
        e.stopPropagation();
        moveImage(idx, 1);
      };
      container.appendChild(div);
    });
  }

  function updateAtlasButtons() {
    var has = images.length > 0;
    document.getElementById('btnGenerate').disabled = !has;
    document.getElementById('btnClear').disabled = !has;
    var sn = document.getElementById('btnSortName');
    if (sn) sn.disabled = !has;
  }

  var btnSortName = document.getElementById('btnSortName');
  if (btnSortName) btnSortName.onclick = sortImagesByName;

  document.getElementById('btnClear').onclick = function () {
    images = [];
    renderThumbs();
    updateAtlasButtons();
    clearAtlasPreview();
  };

  function clearAtlasPreview() {
    var canvas = document.getElementById('atlasCanvas');
    canvas.width = 1;
    canvas.height = 1;
    document.getElementById('atlasInfo').textContent = 'Nenhum atlas gerado ainda.';
    ['btnDownload', 'btnDownload2', 'btnSaveGallery', 'btnSaveGallery2'].forEach(function (id) {
      document.getElementById(id).disabled = true;
    });
    atlasBlob = null;
    atlasDataUrl = null;
  }

  document.getElementById('btnGenerate').onclick = generateAtlas;

  function generateAtlas() {
    if (!images.length) return;
    var parts = document.getElementById('cardSize').value.split('x');
    var cw = parseInt(parts[0], 10), ch = parseInt(parts[1], 10);
    var cols = Math.max(1, parseInt(document.getElementById('cols').value, 10) || 10);
    var pad = Math.max(0, parseInt(document.getElementById('padding').value, 10) || 0);
    var mode = document.getElementById('resizeMode').value;
    var rows = Math.ceil(images.length / cols);
    var totalW = cols * cw + (cols + 1) * pad;
    var totalH = rows * ch + (rows + 1) * pad;

    var canvas = document.getElementById('atlasCanvas');
    canvas.width = totalW;
    canvas.height = totalH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, totalW, totalH);
    ctx.imageSmoothingEnabled = false;

    images.forEach(function (item, i) {
      if (!item || !item.img) return;
      var col = i % cols, row = Math.floor(i / cols);
      var x = pad + col * (cw + pad);
      var y = pad + row * (ch + pad);

      // limpa o slot (transparente) para não sobrar lixo na borda
      ctx.clearRect(x, y, cw, ch);

      var iw = item.img.width;
      var ih = item.img.height;
      if (iw < 1 || ih < 1) return;

      if (mode === 'nearest') {
        // estica exatamente no slot
        ctx.drawImage(item.img, x, y, cw, ch);
      } else if (mode === 'none') {
        // tamanho original, centralizado em pixels inteiros; recorta se passar
        var ox = x + Math.floor((cw - iw) / 2);
        var oy = y + Math.floor((ch - ih) / 2);
        // fonte e destino com clip manual se maior que o slot
        var sx = 0, sy = 0, sw = iw, sh = ih;
        var dx = ox, dy = oy, dw = iw, dh = ih;
        if (dx < x) { sx += (x - dx); sw -= (x - dx); dx = x; }
        if (dy < y) { sy += (y - dy); sh -= (y - dy); dy = y; }
        if (dx + dw > x + cw) { dw = x + cw - dx; sw = dw; }
        if (dy + dh > y + ch) { dh = y + ch - dy; sh = dh; }
        if (sw > 0 && sh > 0) ctx.drawImage(item.img, sx, sy, sw, sh, dx, dy, dw, dh);
      } else if (mode === 'cover') {
        // escala para cobrir o slot (nearest), centraliza, recorta sobra
        var scale = Math.max(cw / iw, ch / ih);
        var dw = Math.max(1, Math.round(iw * scale));
        var dh = Math.max(1, Math.round(ih * scale));
        var dx = x + Math.floor((cw - dw) / 2);
        var dy = y + Math.floor((ch - dh) / 2);
        // desenha em buffer do slot via clip
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cw, ch);
        ctx.clip();
        ctx.drawImage(item.img, dx, dy, dw, dh);
        ctx.restore();
      } else {
        // contain (padrão): cabe inteira no slot + centraliza em pixels inteiros
        var scale2 = Math.min(cw / iw, ch / ih);
        // se já cabe e scale seria > 1, ainda pode upscale para preencher melhor?
        // para pixel art Balatro: não estica além de 1 se a imagem já for menor? 
        // usuário quer lugar certinho — scale para caber (pode ser < 1 ou > 1)
        var dw2 = Math.max(1, Math.round(iw * scale2));
        var dh2 = Math.max(1, Math.round(ih * scale2));
        // garante que não ultrapassa por arredondamento
        if (dw2 > cw) dw2 = cw;
        if (dh2 > ch) dh2 = ch;
        var dx2 = x + Math.floor((cw - dw2) / 2);
        var dy2 = y + Math.floor((ch - dh2) / 2);
        ctx.drawImage(item.img, dx2, dy2, dw2, dh2);
      }
    });

    document.getElementById('atlasInfo').textContent =
      totalW + ' × ' + totalH + ' px · ' + images.length + ' cartas · ' + cols + ' colunas';

    canvas.toBlob(function (blob) {
      if (!blob) { alert('Erro ao gerar PNG.'); return; }
      atlasBlob = blob;
      var reader = new FileReader();
      reader.onload = function () { atlasDataUrl = reader.result; };
      reader.readAsDataURL(blob);
      ['btnDownload', 'btnDownload2', 'btnSaveGallery', 'btnSaveGallery2'].forEach(function (id) {
        document.getElementById(id).disabled = false;
      });
      setAtlasStatus('Atlas gerado. Toque em Salvar PNG.');
    }, 'image/png');
  }

  function downloadAtlas() {
    if (!atlasBlob) {
      var canvas = document.getElementById('atlasCanvas');
      if (canvas && canvas.width > 1) {
        canvas.toBlob(function (blob) {
          if (blob) {
            atlasBlob = blob;
            saveBlob(blob, 'balatro-atlas-' + document.getElementById('cardSize').value + '.png');
          }
        }, 'image/png');
        return;
      }
      alert('Gere o atlas primeiro.');
      return;
    }
    saveBlob(atlasBlob, 'balatro-atlas-' + document.getElementById('cardSize').value + '.png');
  }

  document.getElementById('btnDownload').onclick = downloadAtlas;
  document.getElementById('btnDownload2').onclick = downloadAtlas;

  // ========== GALLERY ==========
  function getGallery() {
    try { return JSON.parse(localStorage.getItem('balatro_atlas_gallery') || '[]'); }
    catch (e) { return []; }
  }
  function saveGallery(list) {
    localStorage.setItem('balatro_atlas_gallery', JSON.stringify(list));
  }

  function saveToGallery() {
    if (!atlasDataUrl && !atlasBlob) return;
    function doSave(dataUrl) {
      var name = prompt('Nome do projeto:', 'Atlas ' + new Date().toLocaleString('pt-BR'));
      if (!name) return;
      var list = getGallery();
      list.unshift({
        id: Date.now(), name: name, size: document.getElementById('cardSize').value,
        count: images.length || 1, date: new Date().toISOString(), dataUrl: dataUrl
      });
      if (list.length > 30) list.length = 30;
      saveGallery(list);
      alert('Salvo na galeria do app!');
    }
    if (atlasDataUrl) doSave(atlasDataUrl);
    else {
      var r = new FileReader();
      r.onload = function () { doSave(r.result); };
      r.readAsDataURL(atlasBlob);
    }
  }
  document.getElementById('btnSaveGallery').onclick = saveToGallery;
  document.getElementById('btnSaveGallery2').onclick = saveToGallery;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderGallery() {
    var list = getGallery();
    var grid = document.getElementById('galleryList');
    var empty = document.getElementById('galleryEmpty');
    grid.innerHTML = '';
    if (!list.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    list.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML =
        '<div class="thumb-wrap checker"><img src="' + item.dataUrl + '" alt=""></div>' +
        '<div class="info"><h3>' + escapeHtml(item.name) + '</h3>' +
        '<p>' + (item.size || '?') + ' · ' + (item.count || '?') + ' · ' + new Date(item.date).toLocaleString('pt-BR') + '</p>' +
        '<div class="actions">' +
        '<button type="button" class="success btn-dl">Baixar</button>' +
        '<button type="button" class="secondary btn-load">Carregar</button>' +
        '<button type="button" class="danger btn-del">Excluir</button></div></div>';
      div.querySelector('.btn-dl').onclick = function () {
        fetch(item.dataUrl).then(function (r) { return r.blob(); }).then(function (b) {
          saveBlob(b, (item.name || 'atlas').replace(/[^\w\-]+/g, '_') + '.png');
        }).catch(function () {
          var a = document.createElement('a');
          a.href = item.dataUrl; a.download = (item.name || 'atlas') + '.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        });
      };
      div.querySelector('.btn-del').onclick = function () {
        if (!confirm('Excluir?')) return;
        saveGallery(getGallery().filter(function (g) { return g.id !== item.id; }));
        renderGallery();
      };
      div.querySelector('.btn-load').onclick = function () {
        var img = new Image();
        img.onload = function () {
          images = [{ id: Date.now(), name: (item.name || 'atlas') + '.png', img: img, dataUrl: item.dataUrl }];
          renderThumbs(); updateAtlasButtons();
          var canvas = document.getElementById('atlasCanvas');
          canvas.width = img.width; canvas.height = img.height;
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          atlasDataUrl = item.dataUrl;
          canvas.toBlob(function (blob) {
            atlasBlob = blob;
            ['btnDownload', 'btnDownload2', 'btnSaveGallery', 'btnSaveGallery2'].forEach(function (id) {
              document.getElementById(id).disabled = false;
            });
          }, 'image/png');
          document.getElementById('atlasInfo').textContent = img.width + ' × ' + img.height + ' px · galeria';
          document.querySelector('[data-tab="preview"]').click();
        };
        img.src = item.dataUrl;
      };
      grid.appendChild(div);
    });
  }

  // ========== COLOR ==========
  function rgbToLab(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    var y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
    var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
  }
  function deltaE(a, b) {
    var dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }
  function medianColor(samples) {
    if (!samples.length) return { r: 255, g: 255, b: 255 };
    var rs = samples.map(function (s) { return s.r; }).sort(function (a, b) { return a - b; });
    var gs = samples.map(function (s) { return s.g; }).sort(function (a, b) { return a - b; });
    var bs = samples.map(function (s) { return s.b; }).sort(function (a, b) { return a - b; });
    var m = (samples.length / 2) | 0;
    return { r: rs[m], g: gs[m], b: bs[m] };
  }
  function sampleEdgeColors(data, w, h) {
    var samples = [], step = Math.max(1, Math.floor(Math.min(w, h) / 50));
    function push(x, y) {
      var i = (y * w + x) * 4;
      if (data[i + 3] >= 12) samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    for (var x = 0; x < w; x += step) { push(x, 0); push(x, h - 1); }
    for (var y = step; y < h - 1; y += step) { push(0, y); push(w - 1, y); }
    return samples;
  }

  // ========== REMOVER ==========
  var removerDrop = document.getElementById('removerDrop');
  var removerInput = document.getElementById('removerInput');
  var srcCanvas = document.getElementById('srcCanvas');
  var outCanvas = document.getElementById('outCanvas');
  var tolSlider = document.getElementById('tolerance');
  var tolValue = document.getElementById('tolValue');
  var statusEl = document.getElementById('removerStatus');
  var modeBadge = document.getElementById('modeBadge');
  var progressBar = document.getElementById('progressBar');
  var progressFill = document.getElementById('progressFill');

  tolSlider.oninput = function () { tolValue.textContent = tolSlider.value; };

  removerDrop.addEventListener('click', function () { removerInput.click(); });
  removerDrop.addEventListener('dragover', function (e) { e.preventDefault(); removerDrop.classList.add('dragover'); });
  removerDrop.addEventListener('dragleave', function () { removerDrop.classList.remove('dragover'); });
  removerDrop.addEventListener('drop', function (e) {
    e.preventDefault();
    removerDrop.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadRemoverImage(e.dataTransfer.files[0]);
  });
  removerInput.addEventListener('change', function () {
    if (removerInput.files[0]) loadRemoverImage(removerInput.files[0]);
  });

  function setStatus(msg) { statusEl.textContent = msg || ''; }
  function setProgress(pct) {
    if (pct <= 0) { progressBar.classList.remove('visible'); progressFill.style.width = '0%'; }
    else { progressBar.classList.add('visible'); progressFill.style.width = Math.min(100, pct) + '%'; }
  }

  function loadRemoverImage(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        lastRemoverDataUrl = ev.target.result;
        fullW = img.width; fullH = img.height;
        undoStack = [];
        fullCanvas = document.createElement('canvas');
        fullCanvas.width = fullW; fullCanvas.height = fullH;
        fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
        fullCtx.drawImage(img, 0, 0);

        var maxDisp = Math.min(520, window.innerWidth - 40);
        var scale = Math.min(1, maxDisp / Math.max(fullW, fullH));
        srcCanvas.width = Math.round(fullW * scale);
        srcCanvas.height = Math.round(fullH * scale);
        outCanvas.width = srcCanvas.width;
        outCanvas.height = srcCanvas.height;

        redrawSrc(); clearOut();
        simpleMode = false;
        modeBadge.style.display = 'none';
        srcCanvas.style.outline = '';
        ['btnAI', 'btnMagic', 'btnSimple', 'btnResetRemover', 'btnDefringe', 'btnHardEdge', 'btnPadBalatro'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.disabled = false;
        });
        document.getElementById('btnUndo').disabled = true;
        document.getElementById('btnDownloadRemover').disabled = true;
        document.getElementById('btnSendToAtlas').disabled = true;
        setStatus('OK ' + fullW + '×' + fullH + '. Magic = auto | Simple = toque');
        setProgress(0);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function redrawSrc() {
    if (!fullCanvas) return;
    var ctx = srcCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
    ctx.drawImage(fullCanvas, 0, 0, srcCanvas.width, srcCanvas.height);
  }
  function clearOut() {
    outCanvas.getContext('2d').clearRect(0, 0, outCanvas.width, outCanvas.height);
  }
  function showResult() {
    if (!fullCanvas) return;
    var ctx = outCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    ctx.drawImage(fullCanvas, 0, 0, outCanvas.width, outCanvas.height);
    document.getElementById('btnDownloadRemover').disabled = false;
    document.getElementById('btnSendToAtlas').disabled = false;
  }
  function pushUndo() {
    if (!fullCtx) return;
    undoStack.push(fullCtx.getImageData(0, 0, fullW, fullH));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    document.getElementById('btnUndo').disabled = false;
  }
  function undoLast() {
    if (!undoStack.length) return;
    fullCtx.putImageData(undoStack.pop(), 0, 0);
    redrawSrc(); showResult();
    document.getElementById('btnUndo').disabled = undoStack.length === 0;
    setStatus('Desfeito.');
  }

  function aiRemove() {
    alert('No Capacitor/APK a IA online costuma falhar (CDN/WASM).\n\nUse MAGIC (remove fundo sozinho, offline) ou SIMPLE (toque na área).\n\nRodando Magic agora.');
    magicRemove();
  }

  function magicRemove() {
    if (!fullCanvas) return;
    setStatus('Magic: processando…');
    setProgress(10);
    simpleMode = false;
    modeBadge.style.display = 'inline-block';
    modeBadge.textContent = 'MAGIC';
    modeBadge.className = 'mode-badge magic';
    srcCanvas.style.outline = '';

    requestAnimationFrame(function () {
      pushUndo();
      var tol = parseInt(tolSlider.value, 10);
      var maxDE = 4 + (tol / 80) * 28;
      var imgData = fullCtx.getImageData(0, 0, fullW, fullH);
      var d = imgData.data;
      var target = medianColor(sampleEdgeColors(d, fullW, fullH));
      var targetLab = rgbToLab(target.r, target.g, target.b);
      var visited = new Uint8Array(fullW * fullH);
      var stack = [];
      var x, y;
      for (x = 0; x < fullW; x++) { stack.push(x); stack.push(x + (fullH - 1) * fullW); }
      for (y = 1; y < fullH - 1; y++) { stack.push(y * fullW); stack.push(fullW - 1 + y * fullW); }

      function isBg(idx) {
        var i = idx * 4;
        if (d[i + 3] < 10) return true;
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var dr = r - target.r, dg = g - target.g, db = b - target.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) > maxDE * 4.2) return false;
        return deltaE(rgbToLab(r, g, b), targetLab) <= maxDE;
      }

      var removed = 0;
      function chunk() {
        var n = 0;
        while (stack.length && n < 100000) {
          var idx = stack.pop(); n++;
          if (idx < 0 || idx >= fullW * fullH || visited[idx]) continue;
          visited[idx] = 1;
          if (!isBg(idx)) continue;
          d[idx * 4 + 3] = 0; removed++;
          var px = idx % fullW, py = (idx / fullW) | 0;
          if (px > 0) stack.push(idx - 1);
          if (px < fullW - 1) stack.push(idx + 1);
          if (py > 0) stack.push(idx - fullW);
          if (py < fullH - 1) stack.push(idx + fullW);
          if (px > 0 && py > 0) stack.push(idx - fullW - 1);
          if (px < fullW - 1 && py > 0) stack.push(idx - fullW + 1);
          if (px > 0 && py < fullH - 1) stack.push(idx + fullW - 1);
          if (px < fullW - 1 && py < fullH - 1) stack.push(idx + fullW + 1);
        }
        setProgress(20 + Math.min(70, removed / (fullW * fullH + 1) * 200));
        if (stack.length) requestAnimationFrame(chunk);
        else {
          var copy = new Uint8ClampedArray(d);
          for (y = 1; y < fullH - 1; y++) {
            for (x = 1; x < fullW - 1; x++) {
              var idx2 = y * fullW + x, i2 = idx2 * 4;
              if (copy[i2 + 3] < 10) continue;
              if (deltaE(rgbToLab(copy[i2], copy[i2 + 1], copy[i2 + 2]), targetLab) > maxDE * 1.35) continue;
              var t = 0, dy, dx;
              for (dy = -1; dy <= 1; dy++)
                for (dx = -1; dx <= 1; dx++)
                  if ((dx || dy) && copy[((y + dy) * fullW + x + dx) * 4 + 3] < 10) t++;
              if (t >= 5) d[i2 + 3] = 0;
              else if (t >= 3) d[i2 + 3] = Math.max(0, d[i2 + 3] - 100);
            }
          }
          fullCtx.putImageData(imgData, 0, 0);
          redrawSrc(); showResult();
          setProgress(100);
          setTimeout(function () { setProgress(0); }, 400);
          setStatus('Magic OK: ~' + removed.toLocaleString('pt-BR') + ' px');
        }
      }
      requestAnimationFrame(chunk);
    });
  }

  function activateSimpleMode() {
    if (!fullCanvas) return;
    simpleMode = true;
    modeBadge.style.display = 'inline-block';
    modeBadge.textContent = 'SIMPLE · toque na imagem';
    modeBadge.className = 'mode-badge simple';
    setStatus('SIMPLE: toque na área a remover (borda vermelha = ativo)');
    srcCanvas.style.outline = '3px solid #e85d4c';
    srcCanvas.style.outlineOffset = '2px';
  }

  function floodFillFromPoint(sx, sy) {
    if (!fullCanvas) return;
    pushUndo();
    var tol = parseInt(tolSlider.value, 10);
    var maxDE = 3 + (tol / 80) * 30;
    var imgData = fullCtx.getImageData(0, 0, fullW, fullH);
    var d = imgData.data;
    var startIdx = sy * fullW + sx;
    var si = startIdx * 4;
    if (d[si + 3] < 10) {
      setStatus('Já transparente.');
      undoStack.pop();
      document.getElementById('btnUndo').disabled = undoStack.length === 0;
      return;
    }
    var targetLab = rgbToLab(d[si], d[si + 1], d[si + 2]);
    var visited = new Uint8Array(fullW * fullH);
    var stack = [startIdx], removed = 0;
    while (stack.length) {
      var idx = stack.pop();
      if (idx < 0 || idx >= fullW * fullH || visited[idx]) continue;
      visited[idx] = 1;
      var i = idx * 4;
      if (d[i + 3] < 10) continue;
      if (deltaE(rgbToLab(d[i], d[i + 1], d[i + 2]), targetLab) > maxDE) continue;
      d[i + 3] = 0; removed++;
      var x = idx % fullW, y = (idx / fullW) | 0;
      if (x > 0) stack.push(idx - 1);
      if (x < fullW - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - fullW);
      if (y < fullH - 1) stack.push(idx + fullW);
      if (x > 0 && y > 0) stack.push(idx - fullW - 1);
      if (x < fullW - 1 && y > 0) stack.push(idx - fullW + 1);
      if (x > 0 && y < fullH - 1) stack.push(idx + fullW - 1);
      if (x < fullW - 1 && y < fullH - 1) stack.push(idx + fullW + 1);
    }
    fullCtx.putImageData(imgData, 0, 0);
    redrawSrc(); showResult();
    setStatus('Simple: ' + removed.toLocaleString('pt-BR') + ' px no toque');
  }

  function canvasCoordsFromClient(clientX, clientY) {
    var rect = srcCanvas.getBoundingClientRect();
    var x = Math.floor((clientX - rect.left) * (fullW / rect.width));
    var y = Math.floor((clientY - rect.top) * (fullH / rect.height));
    return {
      x: Math.max(0, Math.min(fullW - 1, x)),
      y: Math.max(0, Math.min(fullH - 1, y))
    };
  }

  function onPointer(e) {
    if (!simpleMode || !fullCanvas) return;
    e.preventDefault();
    e.stopPropagation();
    var c = canvasCoordsFromClient(e.clientX, e.clientY);
    floodFillFromPoint(c.x, c.y);
  }

  srcCanvas.style.touchAction = 'none';
  srcCanvas.addEventListener('pointerdown', onPointer, { passive: false });
  srcCanvas.addEventListener('click', function (e) {
    if (!simpleMode || !fullCanvas) return;
    var c = canvasCoordsFromClient(e.clientX, e.clientY);
    floodFillFromPoint(c.x, c.y);
  });
  srcCanvas.addEventListener('touchstart', function (e) {
    if (!simpleMode || !fullCanvas) return;
    e.preventDefault();
    var t = e.touches[0];
    var c = canvasCoordsFromClient(t.clientX, t.clientY);
    floodFillFromPoint(c.x, c.y);
  }, { passive: false });

  document.getElementById('btnAI').onclick = aiRemove;
  document.getElementById('btnMagic').onclick = magicRemove;
  document.getElementById('btnSimple').onclick = activateSimpleMode;
  document.getElementById('btnUndo').onclick = undoLast;

  document.getElementById('btnResetRemover').onclick = function () {
    if (!lastRemoverDataUrl) return;
    var img = new Image();
    img.onload = function () {
      fullCtx.clearRect(0, 0, fullW, fullH);
      fullCtx.drawImage(img, 0, 0);
      undoStack = [];
      redrawSrc(); clearOut();
      simpleMode = false;
      modeBadge.style.display = 'none';
      srcCanvas.style.outline = '';
      document.getElementById('btnDownloadRemover').disabled = true;
      document.getElementById('btnSendToAtlas').disabled = true;
      document.getElementById('btnUndo').disabled = true;
      setStatus('Resetado.');
      setProgress(0);
    };
    img.src = lastRemoverDataUrl;
  };

  document.getElementById('btnDownloadRemover').onclick = function () {
    if (!fullCanvas) return;
    fullCanvas.toBlob(function (blob) {
      if (blob) saveBlob(blob, 'balatro-card-transparent.png');
    }, 'image/png');
  };

  document.getElementById('btnSendToAtlas').onclick = function () {
    if (!fullCanvas) return;
    fullCanvas.toBlob(function (blob) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          images.push({ id: Date.now(), name: 'card-transparent.png', img: img, dataUrl: ev.target.result });
          renderThumbs(); updateAtlasButtons();
          document.querySelector('[data-tab="atlas"]').click();
          setStatus('Enviado para o Atlas!');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  };


  // ========== LIMPAR FRANJA / DEFRINGE (anti linha preta Balatro) ==========
  var alphaThresh = document.getElementById('alphaThresh');
  var alphaThreshVal = document.getElementById('alphaThreshVal');
  var erodePasses = document.getElementById('erodePasses');
  var erodePassesVal = document.getElementById('erodePassesVal');
  if (alphaThresh) alphaThresh.oninput = function () { alphaThreshVal.textContent = alphaThresh.value; };
  if (erodePasses) erodePasses.oninput = function () { erodePassesVal.textContent = erodePasses.value; };

  function getAlphaThresh() {
    return parseInt((alphaThresh && alphaThresh.value) || '32', 10);
  }
  function getErodePasses() {
    return parseInt((erodePasses && erodePasses.value) || '1', 10);
  }

  /**
   * Defringe profissional:
   * 1) Mata pixels quase pretos com alpha baixo (causa clássica da linha preta)
   * 2) Threshold de alpha (franja semi-transparente → 0)
   * 3) Erode: qualquer pixel opaco com vizinho transparente e alpha "sujo" é rebaixado
   * 4) Descontaminação de cor: pixels de borda herdam RGB dos vizinhos opacos
   * 5) RGB=0 em todo alpha=0 (straight alpha limpo para LÖVE/Balatro)
   */
  function cleanFringeProfessional() {
    if (!fullCanvas || !fullCtx) return;
    pushUndo();
    setStatus('Limpando franja…');
    setProgress(15);

    var thresh = getAlphaThresh();
    var passes = getErodePasses();
    var zeroRGB = !document.getElementById('chkZeroRGB') || document.getElementById('chkZeroRGB').checked;
    var defringeColor = !document.getElementById('chkDefringeColor') || document.getElementById('chkDefringeColor').checked;
    var killNearBlack = !document.getElementById('chkKillNearBlack') || document.getElementById('chkKillNearBlack').checked;

    var imgData = fullCtx.getImageData(0, 0, fullW, fullH);
    var d = imgData.data;
    var w = fullW, h = fullH;
    var i, x, y, a, r, g, b, n, killed = 0, threshed = 0, eroded = 0, defringed = 0, zeroed = 0;

    // --- Pass 1: matar quase-pretos semi-transparentes ---
    if (killNearBlack) {
      for (i = 0; i < d.length; i += 4) {
        a = d[i + 3];
        if (a === 0 || a >= 250) continue;
        r = d[i]; g = d[i + 1]; b = d[i + 2];
        // luminância baixa + alpha parcial = franja preta típica
        var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum <= 40 && a <= 180) {
          d[i + 3] = 0;
          if (zeroRGB) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
          killed++;
        } else if (lum <= 25 && a <= 220) {
          d[i + 3] = 0;
          if (zeroRGB) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
          killed++;
        }
      }
    }
    setProgress(30);

    // --- Pass 2: threshold de alpha ---
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && d[i + 3] < thresh) {
        d[i + 3] = 0;
        if (zeroRGB) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
        threshed++;
      }
    }
    setProgress(45);

    // --- Pass 3: erode na borda (remove "cabelo" de 1px) ---
    function erodeOnce(src) {
      var out = new Uint8ClampedArray(src);
      var ecount = 0;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          var idx = (y * w + x) * 4;
          if (src[idx + 3] === 0) continue;
          // se tem vizinho 4-conectado transparente, e alpha não é solidíssimo, remove
          var hasT = false;
          if (x > 0 && src[idx - 4 + 3] === 0) hasT = true;
          if (x < w - 1 && src[idx + 4 + 3] === 0) hasT = true;
          if (y > 0 && src[idx - w * 4 + 3] === 0) hasT = true;
          if (y < h - 1 && src[idx + w * 4 + 3] === 0) hasT = true;
          // diagonais
          if (!hasT && x > 0 && y > 0 && src[idx - w * 4 - 4 + 3] === 0) hasT = true;
          if (!hasT && x < w - 1 && y > 0 && src[idx - w * 4 + 4 + 3] === 0) hasT = true;
          if (!hasT && x > 0 && y < h - 1 && src[idx + w * 4 - 4 + 3] === 0) hasT = true;
          if (!hasT && x < w - 1 && y < h - 1 && src[idx + w * 4 + 4 + 3] === 0) hasT = true;

          if (hasT) {
            // borda: se alpha < 250 ou cor muito escura, elimina
            var aa = src[idx + 3];
            var ll = 0.2126 * src[idx] + 0.7152 * src[idx + 1] + 0.0722 * src[idx + 2];
            if (aa < 250 || ll < 30) {
              out[idx + 3] = 0;
              if (zeroRGB) { out[idx] = 0; out[idx + 1] = 0; out[idx + 2] = 0; }
              ecount++;
            }
          }
        }
      }
      return { data: out, count: ecount };
    }

    for (n = 0; n < passes; n++) {
      var er = erodeOnce(d);
      d = er.data;
      eroded += er.count;
    }
    // write back to imgData
    for (i = 0; i < d.length; i++) imgData.data[i] = d[i];
    d = imgData.data;
    setProgress(65);

    // --- Pass 4: descontaminar cor na borda (defringe) ---
    if (defringeColor) {
      var src = new Uint8ClampedArray(d);
      for (y = 1; y < h - 1; y++) {
        for (x = 1; x < w - 1; x++) {
          var idx = (y * w + x) * 4;
          a = src[idx + 3];
          if (a === 0 || a >= 250) continue;
          // média dos vizinhos bem opacos
          var sr = 0, sg = 0, sb = 0, sc = 0, dy, dx;
          for (dy = -1; dy <= 1; dy++) {
            for (dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              var ni = ((y + dy) * w + (x + dx)) * 4;
              if (src[ni + 3] >= 200) {
                sr += src[ni]; sg += src[ni + 1]; sb += src[ni + 2]; sc++;
              }
            }
          }
          if (sc > 0) {
            d[idx] = Math.round(sr / sc);
            d[idx + 1] = Math.round(sg / sc);
            d[idx + 2] = Math.round(sb / sc);
            // reforça alpha se ainda semi
            if (a < thresh) {
              d[idx + 3] = 0;
              if (zeroRGB) { d[idx] = 0; d[idx + 1] = 0; d[idx + 2] = 0; }
            }
            defringed++;
          } else if (a < 200) {
            // sem vizinho opaco: descarta franja
            d[idx + 3] = 0;
            if (zeroRGB) { d[idx] = 0; d[idx + 1] = 0; d[idx + 2] = 0; }
            defringed++;
          }
        }
      }
    }
    setProgress(85);

    // --- Pass 5: RGB=0 em alpha=0 (crítico p/ LÖVE) ---
    if (zeroRGB) {
      for (i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) {
          if (d[i] || d[i + 1] || d[i + 2]) zeroed++;
          d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
        }
      }
    }

    fullCtx.putImageData(imgData, 0, 0);
    redrawSrc();
    showResult();
    setProgress(100);
    setTimeout(function () { setProgress(0); }, 400);
    setStatus(
      'Franja limpa: pretos ' + killed +
      ' · thresh ' + threshed +
      ' · erode ' + eroded +
      ' · defringe ' + defringed +
      ' · rgb0 ' + zeroed
    );
  }

  /** Alpha binário: >= thresh → 255, senão 0; RGB zerado se transparente */
  function hardEdgeAlpha() {
    if (!fullCanvas || !fullCtx) return;
    pushUndo();
    var thresh = getAlphaThresh();
    var zeroRGB = !document.getElementById('chkZeroRGB') || document.getElementById('chkZeroRGB').checked;
    var imgData = fullCtx.getImageData(0, 0, fullW, fullH);
    var d = imgData.data;
    var solid = 0, gone = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= thresh) {
        d[i + 3] = 255;
        solid++;
      } else {
        d[i + 3] = 0;
        if (zeroRGB) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
        gone++;
      }
    }
    fullCtx.putImageData(imgData, 0, 0);
    redrawSrc();
    showResult();
    setStatus('Alpha duro: ' + solid + ' opacos · ' + gone + ' transparentes (limiar ' + thresh + ')');
  }

  /** Força margem transparente de 1px (Balatro 1x) — se a imagem for 71x95 ou 142x190 usa a margem correta */
  function padBalatroMargin() {
    if (!fullCanvas || !fullCtx) return;
    pushUndo();
    var pad = 1;
    if (fullW === 142 && fullH === 190) pad = 2;
    else if (fullW === 71 && fullH === 95) pad = 1;
    else {
      // heurística: se for múltiplo de 71x95 no atlas não aplica por carta aqui;
      // aplica 1px na borda da imagem atual
      pad = 1;
    }

    var imgData = fullCtx.getImageData(0, 0, fullW, fullH);
    var d = imgData.data;
    var x, y, i, cleared = 0;
    for (y = 0; y < fullH; y++) {
      for (x = 0; x < fullW; x++) {
        if (x < pad || y < pad || x >= fullW - pad || y >= fullH - pad) {
          i = (y * fullW + x) * 4;
          if (d[i + 3] !== 0 || d[i] || d[i + 1] || d[i + 2]) cleared++;
          d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
        }
      }
    }
    fullCtx.putImageData(imgData, 0, 0);
    redrawSrc();
    showResult();
    setStatus('Margem Balatro: ' + pad + 'px transparente · ' + cleared + ' pixels limpos na borda');
  }

  var btnDefringe = document.getElementById('btnDefringe');
  var btnHardEdge = document.getElementById('btnHardEdge');
  var btnPadBalatro = document.getElementById('btnPadBalatro');
  if (btnDefringe) btnDefringe.onclick = cleanFringeProfessional;
  if (btnHardEdge) btnHardEdge.onclick = hardEdgeAlpha;
  if (btnPadBalatro) btnPadBalatro.onclick = padBalatroMargin;



  // ========== EDITOR DE CORINGA ==========
  var editorArt = null; // Image
  var editorArtDataUrl = null;
  var editorFrame = null; // Image
  var editorFrameKey = null;
  var artScale = 1;
  var artOffX = 0;
  var artOffY = 0;

  var BUILTIN_FRAMES = [
    { key: 'classica', name: 'Clássica 2x', src: 'assets/frames/moldura_classica.png', size: '142x190' },
    { key: 'classica_1x', name: 'Clássica 1x', src: 'assets/frames/moldura_classica_1x.png', size: '71x95' }
  ];

  var customFrames = []; // { key, name, src, size, img }

  function setEditorStatus(msg) {
    var el = document.getElementById('editorStatus');
    if (el) el.textContent = msg || '';
  }

  function getEditorSize() {
    var v = (document.getElementById('editorSize') || {}).value || '142x190';
    var p = v.split('x');
    return { w: parseInt(p[0], 10), h: parseInt(p[1], 10), key: v };
  }

  function loadImageSrc(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function renderFrameGrid() {
    var grid = document.getElementById('frameGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var all = BUILTIN_FRAMES.concat(customFrames);
    all.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'frame-opt' + (editorFrameKey === f.key ? ' active' : '');
      btn.title = f.name;
      btn.innerHTML = '<img src="' + f.src + '" alt="' + f.name + '">';
      btn.onclick = function () { selectFrame(f); };
      grid.appendChild(btn);
    });
  }

  function selectFrame(f) {
    editorFrameKey = f.key;
    loadImageSrc(f.src).then(function (img) {
      editorFrame = img;
      // auto size match
      var sel = document.getElementById('editorSize');
      if (sel && f.size) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === f.size) { sel.value = f.size; break; }
        }
      }
      renderFrameGrid();
      drawEditor();
      setEditorStatus('Moldura: ' + f.name);
    }).catch(function () {
      setEditorStatus('Erro ao carregar moldura.');
    });
  }

  function drawEditor() {
    var canvas = document.getElementById('editorCanvas');
    if (!canvas) return;
    var size = getEditorSize();
    canvas.width = size.w;
    canvas.height = size.h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size.w, size.h);

    // 1) arte atrás
    if (editorArt) {
      var iw = editorArt.width;
      var ih = editorArt.height;
      var dw = Math.max(1, Math.round(iw * artScale));
      var dh = Math.max(1, Math.round(ih * artScale));
      var dx = Math.floor((size.w - dw) / 2) + Math.round(artOffX);
      var dy = Math.floor((size.h - dh) / 2) + Math.round(artOffY);
      ctx.drawImage(editorArt, dx, dy, dw, dh);
    }

    // 2) moldura na frente
    if (editorFrame) {
      ctx.drawImage(editorFrame, 0, 0, size.w, size.h);
    }

    var has = !!(editorArt || editorFrame);
    var b1 = document.getElementById('btnEditorSave');
    var b2 = document.getElementById('btnEditorToAtlas');
    var b3 = document.getElementById('btnEditorToRemover');
    if (b1) b1.disabled = !has;
    if (b2) b2.disabled = !has;
    if (b3) b3.disabled = !has;
  }

  function loadArtFromDataUrl(dataUrl, name) {
    var img = new Image();
    img.onload = function () {
      editorArt = img;
      editorArtDataUrl = dataUrl;
      artScale = 1;
      artOffX = 0;
      artOffY = 0;
      var sc = document.getElementById('artScale');
      var ox = document.getElementById('artOffX');
      var oy = document.getElementById('artOffY');
      if (sc) { sc.value = 100; document.getElementById('artScaleVal').textContent = '100'; }
      if (ox) { ox.value = 0; document.getElementById('artOffXVal').textContent = '0'; }
      if (oy) { oy.value = 0; document.getElementById('artOffYVal').textContent = '0'; }
      // auto fit contain
      fitArtInSlot();
      drawEditor();
      setEditorStatus('Arte carregada' + (name ? ': ' + name : ''));
    };
    img.src = dataUrl;
  }

  function fitArtInSlot() {
    if (!editorArt) return;
    var size = getEditorSize();
    var scale = Math.min(size.w / editorArt.width, size.h / editorArt.height);
    artScale = scale;
    artOffX = 0;
    artOffY = 0;
    var pct = Math.round(scale * 100);
    var sc = document.getElementById('artScale');
    if (sc) {
      // range max 300 — se scale > 3, clamp display
      sc.value = Math.min(300, Math.max(20, pct));
      document.getElementById('artScaleVal').textContent = String(pct);
    }
    var ox = document.getElementById('artOffX');
    var oy = document.getElementById('artOffY');
    if (ox) { ox.value = 0; document.getElementById('artOffXVal').textContent = '0'; }
    if (oy) { oy.value = 0; document.getElementById('artOffYVal').textContent = '0'; }
  }

  // wire art drop
  (function () {
    var artDrop = document.getElementById('artDrop');
    var artInput = document.getElementById('artInput');
    if (!artDrop || !artInput) return;
    artDrop.addEventListener('click', function () { artInput.click(); });
    artDrop.addEventListener('dragover', function (e) { e.preventDefault(); artDrop.classList.add('dragover'); });
    artDrop.addEventListener('dragleave', function () { artDrop.classList.remove('dragover'); });
    artDrop.addEventListener('drop', function (e) {
      e.preventDefault();
      artDrop.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        var f = e.dataTransfer.files[0];
        var r = new FileReader();
        r.onload = function (ev) { loadArtFromDataUrl(ev.target.result, f.name); };
        r.readAsDataURL(f);
      }
    });
    artInput.addEventListener('change', function () {
      if (!artInput.files[0]) return;
      var f = artInput.files[0];
      var r = new FileReader();
      r.onload = function (ev) { loadArtFromDataUrl(ev.target.result, f.name); };
      r.readAsDataURL(f);
    });
  })();

  // import custom frame
  (function () {
    var frameDrop = document.getElementById('frameDrop');
    var frameInput = document.getElementById('frameInput');
    if (!frameDrop || !frameInput) return;
    frameDrop.addEventListener('click', function () { frameInput.click(); });
    frameDrop.addEventListener('dragover', function (e) { e.preventDefault(); frameDrop.classList.add('dragover'); });
    frameDrop.addEventListener('dragleave', function () { frameDrop.classList.remove('dragover'); });
    function addFrameFile(file) {
      var r = new FileReader();
      r.onload = function (ev) {
        var key = 'custom_' + Date.now();
        var item = { key: key, name: file.name, src: ev.target.result, size: null };
        customFrames.push(item);
        selectFrame(item);
        renderFrameGrid();
        setEditorStatus('Moldura importada: ' + file.name);
      };
      r.readAsDataURL(file);
    }
    frameDrop.addEventListener('drop', function (e) {
      e.preventDefault();
      frameDrop.classList.remove('dragover');
      if (e.dataTransfer.files[0]) addFrameFile(e.dataTransfer.files[0]);
    });
    frameInput.addEventListener('change', function () {
      if (frameInput.files[0]) addFrameFile(frameInput.files[0]);
    });
  })();

  // sliders
  (function () {
    var sc = document.getElementById('artScale');
    var ox = document.getElementById('artOffX');
    var oy = document.getElementById('artOffY');
    if (sc) sc.oninput = function () {
      artScale = parseInt(sc.value, 10) / 100;
      document.getElementById('artScaleVal').textContent = sc.value;
      drawEditor();
    };
    if (ox) ox.oninput = function () {
      artOffX = parseInt(ox.value, 10);
      document.getElementById('artOffXVal').textContent = ox.value;
      drawEditor();
    };
    if (oy) oy.oninput = function () {
      artOffY = parseInt(oy.value, 10);
      document.getElementById('artOffYVal').textContent = oy.value;
      drawEditor();
    };
    var btnC = document.getElementById('btnArtCenter');
    var btnF = document.getElementById('btnArtFit');
    var btnR = document.getElementById('btnArtReset');
    if (btnC) btnC.onclick = function () {
      artOffX = 0; artOffY = 0;
      if (ox) { ox.value = 0; document.getElementById('artOffXVal').textContent = '0'; }
      if (oy) { oy.value = 0; document.getElementById('artOffYVal').textContent = '0'; }
      drawEditor();
    };
    if (btnF) btnF.onclick = function () { fitArtInSlot(); drawEditor(); };
    if (btnR) btnR.onclick = function () {
      artScale = 1; artOffX = 0; artOffY = 0;
      if (sc) { sc.value = 100; document.getElementById('artScaleVal').textContent = '100'; }
      if (ox) { ox.value = 0; document.getElementById('artOffXVal').textContent = '0'; }
      if (oy) { oy.value = 0; document.getElementById('artOffYVal').textContent = '0'; }
      drawEditor();
    };
  })();

  if (document.getElementById('editorSize')) {
    document.getElementById('editorSize').onchange = function () { drawEditor(); };
  }

  function editorExportBlob(cb) {
    var canvas = document.getElementById('editorCanvas');
    if (!canvas) return;
    drawEditor();
    canvas.toBlob(function (blob) { if (blob) cb(blob); }, 'image/png');
  }

  var btnEditorSave = document.getElementById('btnEditorSave');
  if (btnEditorSave) btnEditorSave.onclick = function () {
    editorExportBlob(function (blob) {
      saveBlob(blob, 'joker-' + getEditorSize().key + '.png');
    });
  };

  var btnEditorToAtlas = document.getElementById('btnEditorToAtlas');
  if (btnEditorToAtlas) btnEditorToAtlas.onclick = function () {
    editorExportBlob(function (blob) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          images.push({
            id: Date.now(),
            name: 'joker-edit.png',
            img: img,
            dataUrl: ev.target.result
          });
          renderThumbs();
          updateAtlasButtons();
          document.querySelector('[data-tab="atlas"]').click();
          setEditorStatus('Enviado para o Atlas!');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(blob);
    });
  };

  var btnEditorToRemover = document.getElementById('btnEditorToRemover');
  if (btnEditorToRemover) btnEditorToRemover.onclick = function () {
    editorExportBlob(function (blob) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        // reusa loader do removedor
        lastRemoverDataUrl = ev.target.result;
        var img = new Image();
        img.onload = function () {
          fullW = img.width; fullH = img.height;
          undoStack = [];
          fullCanvas = document.createElement('canvas');
          fullCanvas.width = fullW; fullCanvas.height = fullH;
          fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
          fullCtx.drawImage(img, 0, 0);
          var maxDisp = Math.min(520, window.innerWidth - 40);
          var scale = Math.min(1, maxDisp / Math.max(fullW, fullH));
          srcCanvas.width = Math.round(fullW * scale);
          srcCanvas.height = Math.round(fullH * scale);
          outCanvas.width = srcCanvas.width;
          outCanvas.height = srcCanvas.height;
          redrawSrc(); clearOut();
          ['btnAI', 'btnMagic', 'btnSimple', 'btnResetRemover', 'btnDefringe', 'btnHardEdge', 'btnPadBalatro'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.disabled = false;
          });
          document.querySelector('[data-tab="remover"]').click();
          setStatus('Carta do editor carregada no Removedor.');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(blob);
    });
  };

  // init frames on load
  renderFrameGrid();
  if (BUILTIN_FRAMES[0]) selectFrame(BUILTIN_FRAMES[0]);


  // Diagnóstico Capacitor
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var parts = [];
      if (hasCapacitor()) {
        parts.push('Capacitor:SIM');
        var P = capPlugins();
        parts.push('Filesystem:' + (P && P.Filesystem ? 'SIM' : 'NÃO'));
        parts.push('Share:' + (P && P.Share ? 'SIM' : 'NÃO'));
      } else {
        parts.push('Capacitor:NÃO (navegador ou sync pendente)');
      }
      parts.push(navigator.onLine ? 'Online' : 'Offline');

  // StatusBar Capacitor: não sobrepor o WebView
  try {
    if (hasCapacitor() && capPlugins() && capPlugins().StatusBar) {
      var SB = capPlugins().StatusBar;
      if (SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: false });
      if (SB.setBackgroundColor) SB.setBackgroundColor({ color: '#0f0f12' });
    }
  } catch (e) { log(e); }

      setAtlasStatus(parts.join(' · '));
      log(parts.join(' | '));
    }, 600);
  });
})();
