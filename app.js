(function () {
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) document.body.classList.add('is-mobile');

  var WORLD_W = 1280, WORLD_H = 704, BLOCK = 32;

  var SCRIPT_SANDBOX_WORKER_SRC = [
    '"use strict";',
    '["fetch","XMLHttpRequest","WebSocket","importScripts","indexedDB","caches",',
    ' "Worker","SharedWorker","EventSource","navigator","RTCPeerConnection",',
    ' "BroadcastChannel","open"].forEach(function(k){',
    '  try { Object.defineProperty(self, k, { value: undefined, writable: false, configurable: false }); }',
    '  catch (e) { try { self[k] = undefined; } catch (e2) {} }',
    '});',
    'var player = { x: 0, y: 0, vx: 0, vy: 0, face: 1 };',
    'var blocks = [];',
    'var _update = null;',
    'var _buttons = Object.create(null);',
    'function onUpdate(fn) { if (typeof fn === "function") _update = fn; }',
    'function print(m) { postMessage({ type: "print", msg: String(m) }); }',
    'function addBlock(x, y, color, type) {',
    '  postMessage({ type: "add_block", x: Number(x) || 0, y: Number(y) || 0,',
    '    color: (typeof color === "string" ? color : "#737373").slice(0, 16),',
    '    blockType: type === "kill" ? "kill" : "brick" });',
    '}',
    'function removeBlockAt(index) { postMessage({ type: "remove_block", index: Number(index) }); }',
    'var gui = {',
    '  label: function (id, text, x, y) {',
    '    postMessage({ type: "gui_update", kind: "label", id: String(id).slice(0, 64),',
    '      text: String(text).slice(0, 200), x: Number(x) || 0, y: Number(y) || 0 });',
    '  },',
    '  button: function (id, text, x, y, onClick) {',
    '    var sid = String(id).slice(0, 64);',
    '    _buttons[sid] = typeof onClick === "function" ? onClick : null;',
    '    postMessage({ type: "gui_update", kind: "button", id: sid,',
    '      text: String(text).slice(0, 60), x: Number(x) || 0, y: Number(y) || 0 });',
    '  },',
    '  remove: function (id) {',
    '    var sid = String(id);',
    '    delete _buttons[sid];',
    '    postMessage({ type: "gui_remove", id: sid });',
    '  }',
    '};',
    'self.onmessage = function (e) {',
    '  var d = e.data; if (!d) return;',
    '  if (d.type === "init") {',
    '    try {',
    '      var run = new Function("player", "blocks", "onUpdate", "print", "addBlock", "removeBlockAt", "gui", String(d.src));',
    '      run(player, blocks, onUpdate, print, addBlock, removeBlockAt, gui);',
    '    } catch (err) { postMessage({ type: "error", msg: String(err && err.message || err) }); }',
    '  } else if (d.type === "state") {',
    '    player.x = d.player.x; player.y = d.player.y; player.vx = d.player.vx;',
    '    player.vy = d.player.vy; player.face = d.player.face; blocks = d.blocks || [];',
    '    if (_update) { try { _update(); } catch (err) { postMessage({ type: "error", msg: String(err && err.message || err) }); } }',
    '    postMessage({ type: "player", player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, face: player.face } });',
    '  } else if (d.type === "gui_click") {',
    '    var fn = _buttons[d.id];',
    '    if (fn) { try { fn(); } catch (err) { postMessage({ type: "error", msg: String(err && err.message || err) }); } }',
    '  }',
    '};',
    'postMessage({ type: "ready" });'
  ].join('\n');

  var DEFAULT_SKIN = { head: '#d9d9d9', torso: '#9ca3af', legs: '#4b5563', arms: '#6b7280' };
  function getSkin() {
    try {
      var raw = localStorage.getItem('epikbuild_skin');
      if (!raw) return { head: DEFAULT_SKIN.head, torso: DEFAULT_SKIN.torso, legs: DEFAULT_SKIN.legs, arms: DEFAULT_SKIN.arms };
      var p = JSON.parse(raw);
      return {
        head: typeof p.head === 'string' ? p.head : DEFAULT_SKIN.head,
        torso: typeof p.torso === 'string' ? p.torso : DEFAULT_SKIN.torso,
        legs: typeof p.legs === 'string' ? p.legs : DEFAULT_SKIN.legs,
        arms: typeof p.arms === 'string' ? p.arms : DEFAULT_SKIN.arms
      };
    } catch (e) {
      return { head: DEFAULT_SKIN.head, torso: DEFAULT_SKIN.torso, legs: DEFAULT_SKIN.legs, arms: DEFAULT_SKIN.arms };
    }
  }
  function saveSkin(skin) {
    localStorage.setItem('epikbuild_skin', JSON.stringify(skin));
  }

  var baseCharImg = null;
  var baseCharLoading = null;
  function loadBaseChar(cb) {
    if (baseCharImg) { cb(baseCharImg); return; }
    if (baseCharLoading) { baseCharLoading.push(cb); return; }
    baseCharLoading = [cb];
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      baseCharImg = img;
      var waiters = baseCharLoading;
      baseCharLoading = null;
      waiters.forEach(function (w) { w(img); });
    };
    img.onerror = function () {
      var waiters = baseCharLoading;
      baseCharLoading = null;
      waiters.forEach(function (w) { w(null); });
    };
    img.src = 'character.png';
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function recolorChar(skin, cb) {
    loadBaseChar(function (img) {
      if (!img) { cb('character.png'); return; }
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      if (!ctx) { cb('character.png'); return; }
      ctx.drawImage(img, 0, 0);
      var imageData;
      try { imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch (e) { cb('character.png'); return; }
      var px = imageData.data;
      var head = hexToRgb(skin.head);
      var torso = hexToRgb(skin.torso);
      var arms = hexToRgb(skin.arms);
      var legs = hexToRgb(skin.legs);
      for (var i = 0; i < px.length; i += 4) {
        var a = px[i + 3];
        if (a < 10) continue;
        var x = (i / 4) % canvas.width;
        var y = Math.floor((i / 4) / canvas.width);
        var nx = x / canvas.width;
        var ny = y / canvas.height;
        var lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (lum < 70) continue;
        var c;
        if (ny < 0.29) {
          c = head;
        } else if (ny < 0.59) {
          if (nx > 0.32 && nx < 0.62) c = torso;
          else c = arms;
        } else {
          c = legs;
        }
        var f = lum / 255;
        px[i] = c.r * f;
        px[i + 1] = c.g * f;
        px[i + 2] = c.b * f;
      }
      ctx.putImageData(imageData, 0, 0);
      cb(canvas.toDataURL('image/png'));
    });
  }

  var spriteCache = {};
  function getSpriteUrl(skin, cb) {
    var key = skin.head + '|' + skin.torso + '|' + skin.arms + '|' + skin.legs;
    if (spriteCache[key]) { cb(spriteCache[key]); return; }
    recolorChar(skin, function (url) {
      spriteCache[key] = url;
      cb(url);
    });
  }


  var state = {
    route: { name: 'games', id: null },
    player: null,
    games: [],
    gamesLoaded: false,
    meLoaded: false,
    bootStart: Date.now()
  };

  var app = document.getElementById('app');

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    if (!opts.headers) opts.headers = {};
    if (opts.body && !(opts.body instanceof FormData) && !opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (j) {
        return { status: r.status, json: j };
      });
    });
  }

  function encode(obj) {
    var parts = [];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    }
    return parts.join('&');
  }

  function go(name, id) {
    state.route = { name: name, id: id || null };
    if (name === 'games') {
      loadGames().then(render);
    } else {
      render();
    }
  }

  function loadGames() {
    return api('?api=games&action=list').then(function (res) {
      if (res.json && res.json.ok) {
        state.games = res.json.games || [];
        state.gamesLoaded = true;
      } else {
        state.games = [];
        state.gamesLoaded = true;
      }
    }).catch(function () {
      state.games = [];
      state.gamesLoaded = true;
    });
  }

  function loadMe() {
    return api('?api=auth&action=me').then(function (res) {
      if (res.json && res.json.ok) {
        state.player = res.json.player;
      } else {
        state.player = null;
      }
      state.meLoaded = true;
    }).catch(function () {
      state.player = null;
      state.meLoaded = true;
    });
  }


  function render() {
    while (app.firstChild) app.removeChild(app.firstChild);
    var topbar = renderTopbar();
    app.appendChild(topbar);
    var main = el('div', 'container');
    var r = state.route;
    if (r.name === 'games') {
      main.appendChild(renderGames());
    } else if (r.name === 'auth') {
      main.appendChild(renderAuthPage(r.id || 'signin'));
    } else if (r.name === 'create') {
      main.appendChild(renderCreate());
    } else if (r.name === 'users') {
      main.appendChild(renderUsers());
    } else if (r.name === 'character') {
      main.appendChild(renderCharacter());
    } else if (r.name === 'admin') {
      main.appendChild(renderAdmin());
    } else if (r.name === 'maker') {
      main.appendChild(renderMakerLoading());
      loadMaker(r.id);
    } else if (r.name === 'play') {
      renderPlay(r.id);
      return;
    } else if (r.name === 'adm_invites') {
      main.appendChild(renderInvKeys());
    } else if (r.name === 'adm_games') {
      main.appendChild(renderAdmGames());
    }
    app.appendChild(main);
  }

  function renderTopbar() {
    var bar = el('div', 'topbar');
    var logo = el('div', 'logo', 'e');
    var word = el('div', 'wordmark', 'epikbuild');
    bar.appendChild(logo);
    bar.appendChild(word);
    var spacer = el('div', 'spacer');
    bar.appendChild(spacer);
    var gamesBtn = el('button', 'btn sm', 'Games');
    gamesBtn.onclick = function () { go('games'); };
    bar.appendChild(gamesBtn);
    var createBtn = el('button', 'btn sm dark', 'Create');
    createBtn.onclick = function () {
      if (!state.player) { go('auth', 'signin'); return; }
      go('create');
    };
    bar.appendChild(createBtn);
    var usersBtn = el('button', 'btn sm', 'Users');
    usersBtn.onclick = function () { go('users'); };
    bar.appendChild(usersBtn);
    var charBtn = el('button', 'btn sm', 'Character');
    charBtn.onclick = function () { go('character'); };
    bar.appendChild(charBtn);
    if (state.player && state.player.is_admin) {
      var adminBtn = el('button', 'btn sm', 'Admin');
      adminBtn.onclick = function () { go('admin'); };
      bar.appendChild(adminBtn);
    }
    if (state.player) {
      var uname = el('span', 'tb-user', state.player.username);
      bar.appendChild(uname);
      var out = el('button', 'btn sm', 'Sign out');
      out.onclick = doSignout;
      bar.appendChild(out);
    } else {
      var sin = el('button', 'btn sm', 'Sign in');
      sin.onclick = function () { go('auth', 'signin'); };
      bar.appendChild(sin);
      var sup = el('button', 'btn sm', 'Sign up');
      sup.onclick = function () { go('auth', 'signup'); };
      bar.appendChild(sup);
    }
    return bar;
  }

  function renderGames() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Games'));
    if (!state.gamesLoaded) {
      wrap.appendChild(el('div', 'empty-state', 'Loading games...'));
      return wrap;
    }
    if (!state.games.length) {
      wrap.appendChild(el('div', 'empty-state', 'No games yet. Click Create to build one.'));
      return wrap;
    }
    var grid = el('div', 'games-grid');
    state.games.forEach(function (g) {
      grid.appendChild(renderCard(g));
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderCard(g) {
    var card = el('div', 'game-card');
    var pv = el('div', 'game-preview');
    (g.blocks || []).forEach(function (b) {
      var blk = el('div', 'pv-block');
      blk.style.left = (b.x / WORLD_W * 100) + '%';
      blk.style.top = (b.y / WORLD_H * 100) + '%';
      blk.style.width = (BLOCK / WORLD_W * 100) + '%';
      blk.style.aspectRatio = '1 / 1';
      if (b.type === 'spawn') return;
      if (b.type === 'kill') { blk.classList.add('kill'); blk.style.background = '#dc2626'; }
      else if (b.type === 'ladder') { blk.classList.add('ladder'); blk.style.background = ''; }
      else { blk.style.background = b.color || '#737373'; }
      pv.appendChild(blk);
    });
    var ch = el('div', 'pv-char');
    ch.style.left = '4%';
    ch.style.bottom = '8%';
    pv.appendChild(ch);
    card.appendChild(pv);
    var body = el('div', 'body');
    body.appendChild(el('div', 'title', escapeHtml(g.title)));
    body.appendChild(el('div', 'desc', escapeHtml(g.description || 'No description.')));
    body.appendChild(el('div', 'meta', 'by ' + escapeHtml(g.owner_name || 'unknown')));
    var actions = el('div', 'actions');
    var join = el('button', 'btn black', 'Join');
    join.onclick = function () {
      if (!state.player) { go('auth', 'signin'); return; }
      go('play', g.id);
    };
    actions.appendChild(join);
    if (state.player && g.owner_id === state.player.id) {
      var edit = el('button', 'btn grey', 'Edit');
      edit.onclick = function () { go('maker', g.id); };
      actions.appendChild(edit);
    }
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderCreate() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Create a game'));
    if (!state.player) {
      var note = el('div', 'empty-state', 'You must sign in to create a game.');
      wrap.appendChild(note);
      return wrap;
    }
    var panel = el('div', 'form-panel');
    var f1 = el('div', 'field');
    f1.appendChild(el('label', '', 'Title'));
    var title = el('input', 'input');
    title.maxLength = 50;
    title.placeholder = 'Untitled';
    f1.appendChild(title);
    panel.appendChild(f1);
    var f2 = el('div', 'field');
    f2.appendChild(el('label', '', 'Description'));
    var desc = el('textarea', 'textarea');
    desc.maxLength = 50;
    desc.placeholder = 'What is this level about?';
    f2.appendChild(desc);
    panel.appendChild(f2);
    var err = el('div', 'modal-error');
    panel.appendChild(err);
    var btn = el('button', 'btn black', 'Create & open maker');
    btn.style.width = '100%';
    btn.onclick = function () {
      var t = title.value.trim();
      if (!t) { showError(err, 'Title is required.'); return; }
      btn.disabled = true;
      btn.textContent = 'Creating...';
      api('?api=games&action=create', {
        method: 'POST',
        body: encode({ title: t, description: desc.value.trim(), blocks: '[]' })
      }).then(function (res) {
        if (res.json && res.json.ok) {
          go('maker', res.json.game.id);
        } else {
          btn.disabled = false;
          btn.textContent = 'Create & open maker';
          var errCode = (res.json && res.json.error) || 'create_failed';
          var errMsg = errCode === 'title_invalid' ? 'Title is required and must be 50 characters or fewer.'
            : errCode === 'description_invalid' ? 'Description must be 50 characters or fewer.'
            : 'Something went wrong creating the game.';
          showError(err, errMsg);
        }
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Create & open maker';
        showError(err, 'network_error');
      });
    };
    panel.appendChild(btn);
    wrap.appendChild(panel);
    return wrap;
  }

  function renderUsers() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Users'));
    var list = el('div', 'users-list');
    list.appendChild(el('div', 'empty-state', 'Loading users...'));
    api('?api=users&action=list').then(function (res) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!res.json || !res.json.ok || !res.json.users.length) {
        list.appendChild(el('div', 'empty-state', 'No users yet.'));
        return wrap;
      }
      res.json.users.forEach(function (u) {
        var row = el('div', 'user-row');
        var av = el('div', 'user-avatar', u.username.charAt(0).toUpperCase());
        row.appendChild(av);
        var info = el('div', 'user-info');
        info.appendChild(el('div', 'user-name', escapeHtml(u.username)));
        var d = u.created_at ? new Date(String(u.created_at).replace(' ', 'T') + 'Z') : null;
        var ds = d ? 'joined ' + d.toLocaleDateString() : '';
        info.appendChild(el('div', 'user-meta', ds));
        row.appendChild(info);
        list.appendChild(row);
      });
    }).catch(function () {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(el('div', 'empty-state', 'Failed to load users.'));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderCharacter() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Character'));
    var panel = el('div', 'char-panel');
    var previewBox = el('div', 'char-preview');
    var previewImg = el('img', 'char-preview-img');
    previewImg.src = 'character.png';
    previewImg.alt = 'Character preview';
    previewImg.draggable = false;
    previewBox.appendChild(previewImg);
    previewBox.appendChild(el('div', 'char-preview-label', 'LIVE PREVIEW'));
    panel.appendChild(previewBox);
    var fields = el('div', 'char-fields');
    var parts = [
      { key: 'head', label: 'Head' },
      { key: 'torso', label: 'Torso' },
      { key: 'arms', label: 'Arms' },
      { key: 'legs', label: 'Legs' }
    ];
    var skin = getSkin();
    function refreshPreview() {
      getSpriteUrl(skin, function (url) { previewImg.src = url; });
    }
    refreshPreview();
    parts.forEach(function (p) {
      var f = el('div', 'field');
      f.appendChild(el('label', '', p.label));
      var row = el('div', 'char-row');
      var sw = el('span', 'color-swatch');
      sw.style.background = skin[p.key];
      row.appendChild(sw);
      var ci = el('input');
      ci.type = 'color';
      ci.value = skin[p.key];
      ci.className = 'char-color-input';
      ci.oninput = function (e) {
        skin[p.key] = e.target.value;
        sw.style.background = e.target.value;
        ti.value = e.target.value;
        saveSkin(skin);
        refreshPreview();
      };
      row.appendChild(ci);
      var ti = el('input', 'input char-text-input');
      ti.value = skin[p.key];
      ti.maxLength = 7;
      ti.oninput = function (e) {
        var v = e.target.value;
        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
          skin[p.key] = v;
          sw.style.background = v;
          if (v.length === 7) { ci.value = v; }
          saveSkin(skin);
          refreshPreview();
        }
      };
      row.appendChild(ti);
      f.appendChild(row);
      fields.appendChild(f);
    });
    var reset = el('button', 'btn grey', 'Reset to default');
    reset.style.width = '100%';
    reset.onclick = function () {
      skin = { head: DEFAULT_SKIN.head, torso: DEFAULT_SKIN.torso, legs: DEFAULT_SKIN.legs, arms: DEFAULT_SKIN.arms };
      saveSkin(skin);
      render();
    };
    fields.appendChild(reset);
    panel.appendChild(fields);
    wrap.appendChild(panel);
    return wrap;
  }

  function renderMakerLoading() {
    var wrap = el('div');
    wrap.appendChild(el('div', 'empty-state', 'Loading maker...'));
    return wrap;
  }

  function loadMaker(id) {
    api('?api=games&action=get&id=' + encodeURIComponent(id)).then(function (res) {
      if (!res.json || !res.json.ok) {
        go('games');
        return;
      }
      var g = res.json.game;
      if (!state.player || g.owner_id !== state.player.id) {
        go('games');
        return;
      }
      renderMaker(g);
    }).catch(function () { go('games'); });
  }

  function renderMaker(g) {
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(renderTopbar());
    var main = el('div', 'container');
    var header = el('div', 'maker-header');
    var back = el('button', 'btn', 'Back');
    back.onclick = function () { go('games'); };
    header.appendChild(back);
    var title = el('input', 'title-input');
    title.value = g.title;
    title.maxLength = 50;
    header.appendChild(title);
    var erase = el('button', 'btn grey', 'Erase');
    header.appendChild(erase);
    var clear = el('button', 'btn red', 'Clear');
    header.appendChild(clear);
    var pushbackBtn = el('button', 'btn grey', 'Pushback: Off');
    if (g.pushback) pushbackBtn.textContent = 'Pushback: On';
    if (g.pushback) pushbackBtn.classList.add('active');
    header.appendChild(pushbackBtn);
    var save = el('button', 'btn dark', 'Save');
    header.appendChild(save);
    var play = el('button', 'btn black', 'Play');
    header.appendChild(play);
    main.appendChild(header);

    var makerBody = el('div', 'maker-body');
    var vpCol = el('div', 'maker-vp-col');
    var vp = el('div', 'maker-viewport');
    var grid = el('div', 'maker-grid');
    vp.appendChild(grid);
    var brick = el('button', 'brick-btn active', 'Brick');
    vp.appendChild(brick);
    var kill = el('button', 'kill-btn', 'Killbrick');
    vp.appendChild(kill);
    var colorWrap = el('label', 'color-btn');
    var colorSwatch = el('span', 'color-swatch');
    colorSwatch.style.background = '#737373';
    colorWrap.appendChild(colorSwatch);
    colorWrap.appendChild(el('span', '', 'Color'));
    var colorInput = el('input');
    colorInput.type = 'color';
    colorInput.value = '#737373';
    colorWrap.appendChild(colorInput);
    vp.appendChild(colorWrap);
    var scriptBtn = el('button', 'script-btn', 'Add script');
    vp.appendChild(scriptBtn);
    var ladder = el('button', 'ladder-btn', 'Ladder');
    vp.appendChild(ladder);
    var spawnBtn = el('button', 'spawn-btn', 'Spawn');
    vp.appendChild(spawnBtn);
    vpCol.appendChild(vp);
    var status = el('div', 'maker-status', (g.blocks ? g.blocks.length : 0) + ' blocks');
    vpCol.appendChild(status);
    makerBody.appendChild(vpCol);

    var explorer = el('div', 'explorer');
    var exHead = el('div', 'explorer-head', 'Explorer');
    explorer.appendChild(exHead);
    var exBody = el('div', 'explorer-body');
    var exBlocksLabel = el('div', 'explorer-label', 'Blocks');
    exBody.appendChild(exBlocksLabel);
    var exBlocksList = el('div');
    exBody.appendChild(exBlocksList);
    var exCodeLabel = el('div', 'explorer-label', 'Code');
    exBody.appendChild(exCodeLabel);
    var scriptEntry = el('div', 'explorer-item');
    var scriptIcon = el('span', 'explorer-icon');
    scriptIcon.style.background = '#c4b5fd';
    scriptEntry.appendChild(scriptIcon);
    scriptEntry.appendChild(el('span', 'explorer-name', 'Script'));
    var scriptStatus = el('span', 'explorer-meta', 'empty');
    scriptEntry.appendChild(scriptStatus);
    exBody.appendChild(scriptEntry);
    explorer.appendChild(exBody);
    makerBody.appendChild(explorer);
    main.appendChild(makerBody);
    app.appendChild(main);

    var blocks = (g.blocks || []).slice();
    var pushbackEnabled = g.pushback ? true : false;
    pushbackBtn.onclick = function () {
      pushbackEnabled = !pushbackEnabled;
      pushbackBtn.textContent = pushbackEnabled ? 'Pushback: On' : 'Pushback: Off';
      if (pushbackEnabled) pushbackBtn.classList.add('active');
      else pushbackBtn.classList.remove('active');
      dirty = true;
    };

    var script = g.script || '';
    var tool = 'brick';
    var brickColor = '#737373';
    var dirty = false;

    var makerZoom = 1;
    function getScale() {
      return (vp.clientWidth / WORLD_W) * makerZoom;
    }

    function refreshGrid() {
      var s = getScale();
      var cell = BLOCK * s;
      grid.style.backgroundSize = cell + 'px ' + cell + 'px';
      grid.style.backgroundPosition = (10000) + 'px ' + (10000) + 'px';
    }

    function refreshBlocks() {
      var s = getScale();
      var oldBlocks = makerBlocksLayer.querySelectorAll('.block');
      oldBlocks.forEach(function (b) { b.remove(); });
      blocks.forEach(function (b) {
        var blk = el('div', 'block');
        if (b.type === 'kill') blk.classList.add('kill');
        if (b.type === 'ladder') blk.classList.add('ladder');
        if (b.type === 'spawn') blk.classList.add('spawn');
        blk.style.left = (b.x * s) + 'px';
        blk.style.top = (b.y * s) + 'px';
        blk.style.width = (BLOCK * s) + 'px';
        blk.style.height = (BLOCK * s) + 'px';
        if (b.type === 'kill') blk.style.background = '#dc2626';
        else if (b.type === 'ladder') blk.style.background = '';
        else if (b.type === 'spawn') blk.style.background = '#fde047';
        else blk.style.background = b.color || '#737373';
        makerBlocksLayer.appendChild(blk);
      });
      status.textContent = blocks.length + ' blocks' + (dirty ? ' · unsaved' : '');
    }
    function refreshExplorer() {
      while (exBlocksList.firstChild) exBlocksList.removeChild(exBlocksList.firstChild);
      if (!blocks.length) {
        var empty = el('div', 'explorer-empty', 'No blocks yet');
        exBlocksList.appendChild(empty);
      } else {
        blocks.forEach(function (b, i) {
          var item = el('div', 'explorer-item');
          var ic = el('span', 'explorer-icon');
          ic.style.background = b.type === 'kill' ? '#dc2626' : (b.type === 'ladder' ? '#fde68a' : (b.type === 'spawn' ? '#fde047' : (b.color || '#737373')));
          item.appendChild(ic);
          var labelName = b.type === 'kill' ? 'Killbrick' : (b.type === 'ladder' ? 'Ladder' : (b.type === 'spawn' ? 'Spawn' : 'Brick'));
          item.appendChild(el('span', 'explorer-name', labelName + ' ' + (i + 1)));
          var collWrap = el('label', 'explorer-coll');
          collWrap.appendChild(el('span', '', 'coll'));
          var collCb = el('input');
          collCb.type = 'checkbox';
          collCb.checked = !b.nocoll;
          collCb.onclick = function (e) { e.stopPropagation(); };
          collCb.onchange = function (e) {
            b.nocoll = !collCb.checked;
            dirty = true;
          };
          collWrap.appendChild(collCb);
          item.appendChild(collWrap);
          var bncWrap = el('label', 'explorer-coll');
          bncWrap.appendChild(el('span', '', 'bnc'));
          var bncCb = el('input');
          bncCb.type = 'checkbox';
          bncCb.checked = b.bounce ? true : false;
          bncCb.onclick = function (e) { e.stopPropagation(); };
          bncCb.onchange = function (e) {
            b.bounce = bncCb.checked;
            dirty = true;
          };
          bncWrap.appendChild(bncCb);
          item.appendChild(bncWrap);
          var del = el('span', 'explorer-del', 'del');
          del.onclick = function (e) {
            e.stopPropagation();
            blocks.splice(i, 1);
            dirty = true;
            refreshBlocks();
            refreshExplorer();
          };
          item.appendChild(del);
          exBlocksList.appendChild(item);
        });
      }
      scriptStatus.textContent = script.trim() ? 'edited' : 'empty';
    }
    var makerCamX = 0, makerCamY = 0;
    var makerBlocksLayer = el('div', 'maker-blocks-layer');
    vp.appendChild(makerBlocksLayer);
    grid.style.transformOrigin = '0 0';
    function applyMakerCam() {
      var s = getScale();
      grid.style.transform = 'translate(' + (-makerCamX * s) + 'px,' + (-makerCamY * s) + 'px)';
      makerBlocksLayer.style.transform = 'translate(' + (-makerCamX * s) + 'px,' + (-makerCamY * s) + 'px)';
    }
    applyMakerCam();
    refreshGrid();
    refreshBlocks();
    refreshExplorer();

    function openScriptEditor() {
      var backdrop = el('div', 'modal-backdrop');
      var wrap = el('div', 'modal-wrap');
      var modal = el('div', 'script-modal');
      var head = el('div', 'script-head');
      head.appendChild(el('span', '', 'Script Editor'));
      var headBtns = el('div', 'script-head-btns');
      var saveBtn = el('button', 'btn dark sm', 'Save');
      var closeBtn = el('button', 'btn sm', 'Close');
      headBtns.appendChild(saveBtn);
      headBtns.appendChild(closeBtn);
      head.appendChild(headBtns);
      modal.appendChild(head);
      var ta = el('textarea', 'script-textarea');
      ta.value = script;
      ta.spellcheck = false;
      ta.placeholder = "";
      modal.appendChild(ta);
      wrap.appendChild(modal);
      backdrop.appendChild(wrap);
      document.body.appendChild(backdrop);
      function close() { backdrop.remove(); }
      closeBtn.onclick = close;
      saveBtn.onclick = function () {
        script = ta.value;
        dirty = true;
        refreshExplorer();
        close();
      };
      backdrop.onclick = function (e) { if (e.target === backdrop) close(); };
      ta.focus();
    }
    scriptBtn.onclick = function (e) {
      e.stopPropagation();
      scriptEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scriptEntry.classList.remove('pulse');
      void scriptEntry.offsetWidth;
      scriptEntry.classList.add('pulse');
    };
    scriptEntry.onclick = openScriptEditor;

    function setTool(t) {
      tool = t;
      if (t === 'brick') {
        brick.classList.add('active');
        kill.classList.remove('active');
        ladder.classList.remove('active');
        spawnBtn.classList.remove('active');
        erase.classList.remove('active');
        vp.classList.remove('erase');
      } else if (t === 'kill') {
        kill.classList.add('active');
        brick.classList.remove('active');
        ladder.classList.remove('active');
        spawnBtn.classList.remove('active');
        erase.classList.remove('active');
        vp.classList.remove('erase');
      } else if (t === 'ladder') {
        ladder.classList.add('active');
        brick.classList.remove('active');
        kill.classList.remove('active');
        spawnBtn.classList.remove('active');
        erase.classList.remove('active');
        vp.classList.remove('erase');
      } else if (t === 'spawn') {
        spawnBtn.classList.add('active');
        brick.classList.remove('active');
        kill.classList.remove('active');
        ladder.classList.remove('active');
        erase.classList.remove('active');
        vp.classList.remove('erase');
      } else {
        erase.classList.add('active');
        brick.classList.remove('active');
        kill.classList.remove('active');
        ladder.classList.remove('active');
        spawnBtn.classList.remove('active');
        vp.classList.add('erase');
      }
    }

    brick.onclick = function (e) { e.stopPropagation(); setTool('brick'); };
    kill.onclick = function (e) { e.stopPropagation(); setTool('kill'); };
    ladder.onclick = function (e) { e.stopPropagation(); setTool('ladder'); };
    spawnBtn.onclick = function (e) { e.stopPropagation(); setTool('spawn'); };
    erase.onclick = function () { setTool('erase'); };
    colorInput.oninput = function (e) {
      brickColor = e.target.value;
      colorSwatch.style.background = brickColor;
      setTool('brick');
    };
    colorWrap.onclick = function (e) { e.stopPropagation(); };

    function snapWorld(v, max) {
      var s = Math.round(v / BLOCK) * BLOCK;
      return s;
    }

    var panActive = false;
    var panLastX = 0, panLastY = 0;
    var pinchDist = 0;
    var twoFingerPan = false;

    vp.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    vp.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var oldZoom = makerZoom;
      if (e.deltaY < 0) makerZoom = Math.min(3, makerZoom * 1.1);
      else makerZoom = Math.max(0.3, makerZoom / 1.1);
      if (makerZoom !== oldZoom) {
        refreshGrid();
        refreshBlocks();
        applyMakerCam();
      }
    }, { passive: false });
    vp.addEventListener('pointerdown', function (e) {
      if (e.button === 2 || e.buttons === 2) {
        panActive = true;
        panLastX = e.clientX;
        panLastY = e.clientY;
        vp.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    window.addEventListener('pointermove', function (e) {
      if (panActive) {
        var dx = e.clientX - panLastX;
        var dy = e.clientY - panLastY;
        panLastX = e.clientX;
        panLastY = e.clientY;
        var s = getScale();
        makerCamX -= dx / s;
        makerCamY -= dy / s;
        applyMakerCam();
      }
    });
    window.addEventListener('pointerup', function (e) {
      if (e.button === 2 || panActive) {
        panActive = false;
        vp.style.cursor = '';
      }
    });

    vp.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        twoFingerPan = true;
        var t1 = e.touches[0], t2 = e.touches[1];
        panLastX = (t1.clientX + t2.clientX) / 2;
        panLastY = (t1.clientY + t2.clientY) / 2;
        var ddx = t1.clientX - t2.clientX;
        var ddy = t1.clientY - t2.clientY;
        pinchDist = Math.sqrt(ddx * ddx + ddy * ddy);
        e.preventDefault();
      }
    }, { passive: false });
    vp.addEventListener('touchmove', function (e) {
      if (twoFingerPan && e.touches.length === 2) {
        var t1 = e.touches[0], t2 = e.touches[1];
        var midX = (t1.clientX + t2.clientX) / 2;
        var midY = (t1.clientY + t2.clientY) / 2;
        var dx = midX - panLastX;
        var dy = midY - panLastY;
        panLastX = midX;
        panLastY = midY;
        var s = getScale();
        makerCamX -= dx / s;
        makerCamY -= dy / s;
        var newDx = t1.clientX - t2.clientX;
        var newDy = t1.clientY - t2.clientY;
        var newDist = Math.sqrt(newDx * newDx + newDy * newDy);
        if (pinchDist > 0 && newDist > 0) {
          var ratio = newDist / pinchDist;
          makerZoom = Math.max(0.3, Math.min(3, makerZoom * ratio));
          pinchDist = newDist;
          refreshGrid();
          refreshBlocks();
        }
        applyMakerCam();
        e.preventDefault();
      }
    }, { passive: false });
    vp.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) twoFingerPan = false;
    });

    vp.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      if (e.target === brick || e.target === kill || e.target === ladder || e.target === spawnBtn) return;
      var rect = vp.getBoundingClientRect();
      var s = getScale();
      var wx = (e.clientX - rect.left + makerCamX * s) / s;
      var wy = (e.clientY - rect.top + makerCamY * s) / s;
      if (tool === 'brick' || tool === 'kill' || tool === 'ladder') {
        var bx = snapWorld(wx - BLOCK / 2, WORLD_W);
        var by = snapWorld(wy - BLOCK / 2, WORLD_H);
        var blkColor = tool === 'kill' ? '#dc2626' : (tool === 'ladder' ? '#fde68a' : brickColor);
        blocks.push({ id: 'b' + Date.now() + '_' + Math.floor(Math.random() * 9999), x: bx, y: by, type: tool, color: blkColor });
        dirty = true;
        refreshBlocks();
        refreshExplorer();
      } else if (tool === 'spawn') {
        var sx = snapWorld(wx - BLOCK / 2, WORLD_W);
        var sy = snapWorld(wy - BLOCK / 2, WORLD_H);
        for (var si = blocks.length - 1; si >= 0; si--) {
          if (blocks[si].type === 'spawn') blocks.splice(si, 1);
        }
        blocks.push({ id: 'spawn_' + Date.now(), x: sx, y: sy, type: 'spawn', color: '#fde047' });
        dirty = true;
        refreshBlocks();
        refreshExplorer();
      } else {
        for (var i = blocks.length - 1; i >= 0; i--) {
          var b = blocks[i];
          if (wx >= b.x && wx <= b.x + BLOCK && wy >= b.y && wy <= b.y + BLOCK) {
            blocks.splice(i, 1);
            dirty = true;
            refreshBlocks();
            refreshExplorer();
            break;
          }
        }
      }
    });

    function onResize() { refreshGrid(); refreshBlocks(); }
    window.addEventListener('resize', onResize);

    clear.onclick = function () {
      if (!confirm('Are you sure you want to clear all blocks?')) return;
      blocks = [];
      dirty = true;
      refreshBlocks();
      refreshExplorer();
    };

    function doSave(cb) {
      save.disabled = true;
      save.textContent = 'Saving...';
      var saveBody = JSON.stringify({ id: g.id, title: title.value.trim() || 'Untitled', description: g.description || '', blocks: JSON.stringify(blocks), script: script, pushback: pushbackEnabled ? 1 : 0 });
      fetch('?api=games&action=update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: saveBody
      }).then(function (r) { return r.json(); }).then(function (j) {
        save.disabled = false;
        save.textContent = 'Save';
        if (j && j.ok) {
          dirty = false;
          status.textContent = blocks.length + ' blocks · saved';
          if (cb) cb(true);
        } else {
          var errCode = (j && j.error) ? j.error : 'unknown';
          status.textContent = blocks.length + ' blocks · save failed: ' + errCode;
          if (errCode === 'not_authenticated') {
            alert('You are not logged in. Your session may have expired — please sign in again.');
            go('auth', 'signin');
            return;
          }
          if (cb) cb(false);
        }
      }).catch(function (err) {
        save.disabled = false;
        save.textContent = 'Save';
        status.textContent = blocks.length + ' blocks · save failed: network';
        if (cb) cb(false);
      });
    }

    save.onclick = function () { doSave(null); };
    play.onclick = function () {
      doSave(function (ok) { go('play', g.id); });
    };
  }

  var playCleanup = null;

  function renderPlay(id) {
    while (app.firstChild) app.removeChild(app.firstChild);
    var client = el('div', 'client');
    var back = el('button', 'back-btn', 'Leave');
    client.appendChild(back);
    var fsBtn = el('button', 'fs-btn', 'Fullscreen');
    client.appendChild(fsBtn);
    fsBtn.onclick = function () {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', function () {
      fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    });
    var cloud1 = el('div', 'cloud');
    cloud1.style.left = '8%'; cloud1.style.top = '12%'; cloud1.style.width = '12%'; cloud1.style.height = '5%';
    client.appendChild(cloud1);
    var cloud2 = el('div', 'cloud');
    cloud2.style.left = '62%'; cloud2.style.top = '8%'; cloud2.style.width = '16%'; cloud2.style.height = '4%';
    client.appendChild(cloud2);
    var cloud3 = el('div', 'cloud');
    cloud3.style.left = '35%'; cloud3.style.top = '20%'; cloud3.style.width = '12%'; cloud3.style.height = '4%';
    cloud3.style.background = 'rgba(255,255,255,0.6)';
    client.appendChild(cloud3);
    var ground = el('div', 'ground');
    client.appendChild(ground);
    app.appendChild(client);

    var charWrap = el('div', 'char');
    var charImg = el('img');
    charImg.src = 'character.png';
    charImg.alt = '';
    charImg.draggable = false;
    charWrap.appendChild(charImg);
    client.appendChild(charWrap);
    getSpriteUrl(getSkin(), function (url) { charImg.src = url; });

    var dpadLeft = el('div', 'dpad left');
    var dpl = el('button', 'dpad-btn', '\u2190');
    var dpr = el('button', 'dpad-btn', '\u2192');
    dpadLeft.appendChild(dpl);
    dpadLeft.appendChild(dpr);
    var dpadRight = el('div', 'dpad right');
    var dj = el('button', 'dpad-btn jump', 'Jump');
    dpadRight.appendChild(dj);
    client.appendChild(dpadLeft);
    client.appendChild(dpadRight);

    api('?api=games&action=get&id=' + encodeURIComponent(id)).then(function (res) {
      if (!res.json || !res.json.ok) { go('games'); return; }
      var g = res.json.game;
      startClient(client, charWrap, charImg, g, back, dpl, dpr, dj, id, ground);
    }).catch(function () { go('games'); });
  }

  function startClient(client, charWrap, charImg, g, backBtn, dpl, dpr, dj, gameId, groundEl) {
    var keys = {};
    var st = { x: 48, y: 0, vx: 0, vy: 0, onGround: false, face: 1 };
    var world = { w: WORLD_W, h: WORLD_H, charW: 96, charH: 168, gravity: 0.55, move: 3.6, jump: 14, maxFall: 17, blocks: [] };
    var scale = 1;
    var zoomLevel = isMobile ? 0.5 : 1;
    var camX = 0, camY = 0;
    var blocksLayer = null;
    var rafId = null;
    var others = {};
    var otherEls = {};
    var otherTargets = {};
    var stopPolling = false;
    var moveTimer = null;
    var pollTimer = null;

    world.blocks = (g.blocks || []).map(function (b) {
      return { x: b.x, y: b.y, w: BLOCK, h: BLOCK, type: b.type || 'brick', color: b.color || '#737373', nocoll: b.nocoll ? true : false, bounce: b.bounce ? true : false };
    });
    var pushbackMode = g.pushback ? true : false;
    var spawnBlock = null;
    for (var si = 0; si < world.blocks.length; si++) {
      if (world.blocks[si].type === 'spawn') { spawnBlock = world.blocks[si]; break; }
    }
    if (spawnBlock) {
      st.x = spawnBlock.x;
      st.y = spawnBlock.y;
    }
    camX = st.x - (WORLD_W / 2) + (world.charW / 2);
    camY = st.y - (WORLD_H / 2) + (world.charH / 2);

    var scriptWorker = null;
    var scriptReady = false;
    var scriptSrc = g.script || '';
    var guiEls = {};
    var guiLayer = null;
    var MAX_SCRIPT_BLOCKS = 400;

    function guiLayerEl() {
      if (!guiLayer) {
        guiLayer = el('div', 'script-gui-layer');
        client.appendChild(guiLayer);
      }
      return guiLayer;
    }
    function positionGuiEl(node, x, y) {
      node.style.left = ((x - camX) * scale) + 'px';
      node.style.top = ((y - camY) * scale) + 'px';
    }
    function repositionAllGui() {
      for (var gid in guiEls) {
        var entry = guiEls[gid];
        positionGuiEl(entry.node, entry.x, entry.y);
      }
    }
    function handleGuiUpdate(d) {
      var id = String(d.id || '').slice(0, 64);
      if (!id) return;
      var text = String(d.text == null ? '' : d.text).slice(0, 200);
      var x = Number(d.x) || 0, y = Number(d.y) || 0;
      var entry = guiEls[id];
      if (!entry) {
        var node;
        if (d.kind === 'button') {
          node = el('button', 'script-gui-btn');
          node.type = 'button';
          node.onclick = function () {
            if (scriptWorker && scriptReady) {
              try { scriptWorker.postMessage({ type: 'gui_click', id: id }); } catch (e) {}
            }
          };
        } else {
          node = el('div', 'script-gui-label');
        }
        node.textContent = text;
        guiLayerEl().appendChild(node);
        entry = guiEls[id] = { node: node, x: x, y: y, kind: d.kind };
      } else {
        entry.node.textContent = text;
        entry.x = x; entry.y = y;
      }
      positionGuiEl(entry.node, x, y);
    }
    function handleGuiRemove(d) {
      var id = String(d.id || '');
      var entry = guiEls[id];
      if (entry) { entry.node.remove(); delete guiEls[id]; }
    }
    function handleAddBlock(d) {
      if (world.blocks.length >= MAX_SCRIPT_BLOCKS) return;
      var x = Number(d.x) || 0;
      var y = Number(d.y) || 0;
      var color = /^#[0-9a-fA-F]{3,8}$/.test(d.color) ? d.color : '#737373';
      var type = d.blockType === 'kill' ? 'kill' : (d.blockType === 'ladder' ? 'ladder' : 'brick');
      world.blocks.push({ x: x, y: y, w: BLOCK, h: BLOCK, type: type, color: color });
      renderBlocks();
    }
    function handleRemoveBlock(d) {
      var index = Number(d.index);
      if (index >= 0 && index < world.blocks.length) {
        world.blocks.splice(index, 1);
        renderBlocks();
      }
    }
    function clearGui() {
      for (var gid in guiEls) { guiEls[gid].node.remove(); }
      guiEls = {};
      if (guiLayer) { guiLayer.remove(); guiLayer = null; }
    }

    if (scriptSrc.trim() && typeof Worker !== 'undefined') {
      try {
        var workerSrc = SCRIPT_SANDBOX_WORKER_SRC;
        var blob = new Blob([workerSrc], { type: 'application/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        scriptWorker = new Worker(blobUrl);
        URL.revokeObjectURL(blobUrl);
        scriptWorker.onmessage = function (e) {
          var d = e.data;
          if (!d) return;
          if (d.type === 'print') console.log('[script]', d.msg);
          else if (d.type === 'error') console.error('[script] error:', d.msg);
          else if (d.type === 'ready') {
            scriptReady = true;
            scriptWorker.postMessage({ type: 'init', src: scriptSrc });
          }
          else if (d.type === 'player' && d.player) {
            st.x = d.player.x; st.y = d.player.y; st.vx = d.player.vx; st.vy = d.player.vy; st.face = d.player.face;
          }
          else if (d.type === 'gui_update') handleGuiUpdate(d);
          else if (d.type === 'gui_remove') handleGuiRemove(d);
          else if (d.type === 'add_block') handleAddBlock(d);
          else if (d.type === 'remove_block') handleRemoveBlock(d);
        };
        scriptWorker.onerror = function (e) {
          console.error('[script] worker error:', e.message);
        };
      } catch (e) {
        console.error('[script] sandbox failed to start:', e);
        scriptWorker = null;
      }
    }

    function measure() {
      var W = client.clientWidth;
      var H = client.clientHeight;
      if (W === 0 || H === 0) return;
      scale = (W / WORLD_W) * zoomLevel;
      var charH = world.charH * scale;
      var charW = world.charW * scale;
      charWrap.style.width = charW + 'px';
      charWrap.style.height = charH + 'px';
      renderBlocks();
      repositionAllGui();
    }
    client.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var oldZoom = zoomLevel;
      if (e.deltaY < 0) zoomLevel = Math.min(3, zoomLevel * 1.1);
      else zoomLevel = Math.max(0.3, zoomLevel / 1.1);
      if (zoomLevel !== oldZoom) measure();
    }, { passive: false });

    function renderBlocks() {
      if (!blocksLayer) {
        blocksLayer = el('div', 'blocks-layer');
        client.insertBefore(blocksLayer, client.firstChild);
      }
      var existing = blocksLayer.querySelectorAll('.block');
      existing.forEach(function (b) { b.remove(); });
      world.blocks.forEach(function (b) {
        if (b.type === 'spawn') return;
        var blk = el('div', 'block');
        if (b.type === 'kill') blk.classList.add('kill');
        if (b.type === 'ladder') blk.classList.add('ladder');
        blk.style.left = (b.x * scale) + 'px';
        blk.style.top = (b.y * scale) + 'px';
        blk.style.width = (BLOCK * scale) + 'px';
        blk.style.height = (BLOCK * scale) + 'px';
        if (b.type === 'kill') blk.style.background = '#dc2626';
        else if (b.type === 'ladder') blk.style.background = '';
        else blk.style.background = b.color || '#737373';
        blocksLayer.appendChild(blk);
      });
    }

    function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function resetChar() {
      var spawn = null;
      for (var i = 0; i < world.blocks.length; i++) {
        if (world.blocks[i].type === 'spawn') { spawn = world.blocks[i]; break; }
      }
      if (spawn) {
        st.x = spawn.x;
        st.y = spawn.y;
      } else {
        st.x = 48;
        st.y = 0;
      }
      st.vx = 0;
      st.vy = 0;
      st.onGround = false;
      st.lastTime = 0;
    }

    var FIXED_DT = 1 / 60;
    var stepAccumulator = 0;
    var lastFrameTime = 0;

    function step(ts) {
      if (!lastFrameTime) lastFrameTime = ts;
      var elapsed = (ts - lastFrameTime) / 1000;
      lastFrameTime = ts;
      if (elapsed > 0.25) elapsed = 0.25;
      stepAccumulator += elapsed;
      var maxSteps = 5;
      var steps = 0;
      while (stepAccumulator >= FIXED_DT && steps < maxSteps) {
        physicsStep(FIXED_DT);
        stepAccumulator -= FIXED_DT;
        steps++;
      }
      if (steps === maxSteps) stepAccumulator = 0;
      var W = client.clientWidth;
      var H = client.clientHeight;
      var screenX = (st.x - camX) * scale;
      var screenY = (st.y - camY) * scale;
      var charWpx = world.charW * scale;
      var charHpx = world.charH * scale;
      var targetCamX = st.x - W / (2 * scale);
      var targetCamY = st.y - H / (2 * scale);
      if (screenX < 0) targetCamX = st.x;
      else if (screenX + charWpx > W) targetCamX = st.x + world.charW - W / scale;
      if (screenY < 0) targetCamY = st.y;
      else if (screenY + charHpx > H) targetCamY = st.y + world.charH - H / scale;
      camX += (targetCamX - camX) * 0.08;
      camY += (targetCamY - camY) * 0.08;
      if (blocksLayer) {
        blocksLayer.style.transform = 'translate(' + (-camX * scale) + 'px,' + (-camY * scale) + 'px)';
      }
      if (groundEl) {
        groundEl.style.top = ((WORLD_H - camY) * scale) + 'px';
        groundEl.style.bottom = '0';
        groundEl.style.height = 'auto';
      }
      charWrap.style.transform = 'translate(' + ((st.x - camX) * scale) + 'px,' + ((st.y - camY) * scale) + 'px)';
      charImg.style.transform = 'scaleX(' + st.face + ')';
      for (var opid in otherEls) {
        var ot = otherTargets[opid];
        if (!ot) continue;
        ot.dispX += (ot.x - ot.dispX) * 0.4;
        ot.dispY += (ot.y - ot.dispY) * 0.4;
        var oel = otherEls[opid];
        oel.style.width = (world.charW * scale) + 'px';
        oel.style.height = (world.charH * scale) + 'px';
        oel.style.transform = 'translate(' + ((ot.dispX - camX) * scale) + 'px,' + ((ot.dispY - camY) * scale) + 'px)';
        var oim = oel.querySelector('img');
        if (oim) oim.style.transform = 'scaleX(' + ot.face + ')';
      }
      if (scriptWorker && scriptReady) {
        try {
          scriptWorker.postMessage({
            type: 'state',
            player: { x: st.x, y: st.y, vx: st.vx, vy: st.vy, face: st.face },
            blocks: w.blocks.map(function (b) { return { x: b.x, y: b.y, type: b.type, color: b.color }; })
          });
        } catch (e) { console.error('[script] post error:', e); scriptReady = false; }
      }
      rafId = requestAnimationFrame(step);
    }

    function physicsStep(dt) {
      var w = world;
      var CW = w.charW, CH = w.charH;
      var PAD_X = 24, PAD_TOP = 10, PAD_BOTTOM = 15;
      var cbX = st.x + PAD_X, cbY = st.y + PAD_TOP;
      var cbW = CW - PAD_X * 2, cbH = CH - PAD_TOP - PAD_BOTTOM;
      var ax = 0;
      if (keys['a'] || keys['arrowleft']) ax -= 1;
      if (keys['d'] || keys['arrowright']) ax += 1;
      if (ax !== 0) {
        st.vx = ax * w.move;
        st.face = ax;
      } else {
        st.vx *= 0.78;
        if (Math.abs(st.vx) < 0.05) st.vx = 0;
      }
      var jumpHeld = !!(keys['w'] || keys['arrowup'] || keys[' ']);
      if (jumpHeld && st.onGround) {
        st.vy = -w.jump;
      st.onGround = false;
      }
      if (keys['r']) resetChar();
      var bl = w.blocks;
      var onLadder = false;
      for (var li = 0; li < bl.length; li++) {
        var lb = bl[li];
        if (lb.type === 'ladder' && overlap(cbX, cbY, cbW, cbH, lb.x, lb.y, lb.w, lb.h)) {
          onLadder = true;
          break;
        }
      }
      if (onLadder) {
        st.vy = 0;
        if (jumpHeld) st.vy = -3.5;
        else if (keys['s'] || keys['arrowdown']) st.vy = 3.5;
        st.vx *= 0.5;
      } else {
        st.vy += w.gravity;
        if (st.vy > w.maxFall) st.vy = w.maxFall;
      }
      var moveX = st.vx;
      var moveY = st.vy;
      var stepsX = Math.max(1, Math.ceil(Math.abs(moveX) / (cbW * 0.4)));
      var stepsY = Math.max(1, Math.ceil(Math.abs(moveY) / (cbH * 0.4)));
      var incX = moveX / stepsX;
      var incY = moveY / stepsY;
      for (var sx = 0; sx < stepsX; sx++) {
        st.x += incX;
        cbX = st.x + PAD_X; cbY = st.y + PAD_TOP;
        for (var i = 0; i < bl.length; i++) {
          var b = bl[i];
          if (b.type === 'ladder') continue;
          if (b.nocoll) continue;
          if (overlap(cbX, cbY, cbW, cbH, b.x, b.y, b.w, b.h)) {
            if (b.type === 'kill') { resetChar(); break; }
            if (pushbackMode) {
              if (incX > 0) { st.vx = -30; st.x = b.x - PAD_X - cbW - 4; }
              else if (incX < 0) { st.vx = 30; st.x = b.x + b.w - PAD_X + 4; }
              cbX = st.x + PAD_X;
            } else {
              if (incX > 0) st.x = b.x - PAD_X - cbW;
              else if (incX < 0) st.x = b.x + b.w - PAD_X;
              st.vx = 0;
              cbX = st.x + PAD_X;
            }
          }
        }
      }
      st.onGround = false;
      for (var sy = 0; sy < stepsY; sy++) {
        st.y += incY;
        cbY = st.y + PAD_TOP;
        for (var j = 0; j < bl.length; j++) {
          var b2 = bl[j];
          if (b2.type === 'ladder') continue;
          if (b2.nocoll) continue;
          if (overlap(cbX, cbY, cbW, cbH, b2.x, b2.y, b2.w, b2.h)) {
            if (b2.type === 'kill') { resetChar(); break; }
            if (b2.bounce && incY > 0) {
              st.vy = -18;
              st.y = b2.y - CH + PAD_BOTTOM - 2;
              st.onGround = false;
              cbY = st.y + PAD_TOP;
            } else if (b2.bounce && incY < 0) {
              st.vy = 10;
              st.y = b2.y + b2.h - PAD_TOP + 2;
              cbY = st.y + PAD_TOP;
            } else if (incY > 0) {
              st.y = b2.y - CH + PAD_BOTTOM;
              st.vy = 0;
              st.onGround = true;
              cbY = st.y + PAD_TOP;
            } else if (incY < 0) {
              st.y = b2.y + b2.h - PAD_TOP;
              st.vy = 0;
            }
          }
        }
        if (st.y + CH - PAD_BOTTOM >= w.h) {
          st.y = w.h - CH + PAD_BOTTOM;
          st.vy = 0;
          st.onGround = true;
        }
      }
    }

    function sendMove() {
      if (!scale) return;
      if (!mpReady || !myRef) return;
      var xp = (st.x / WORLD_W) * 100;
      var yp = (st.y / WORLD_H) * 100;
      myRef.set({
        name: state.player ? state.player.username : 'player',
        x: xp, y: yp, face: st.face, skin: getSkin(),
        ts: Date.now()
      }).catch(function () {});
    }

    function onResize() { measure(); }
    window.addEventListener('resize', onResize);

    var tracked = ['a', 'd', 'w', 's', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'r'];
    var codeMap = {
      'KeyA': 'a', 'KeyD': 'd', 'KeyW': 'w', 'KeyS': 's', 'KeyR': 'r',
      'Space': ' ',
      'ArrowLeft': 'arrowleft', 'ArrowRight': 'arrowright',
      'ArrowUp': 'arrowup', 'ArrowDown': 'arrowdown'
    };
    function keydown(e) {
      var k = codeMap[e.code] || e.key.toLowerCase();
      if (tracked.indexOf(k) !== -1) {
        keys[k] = true;
        e.preventDefault();
      }
    }
    function keyup(e) {
      var k = codeMap[e.code] || e.key.toLowerCase();
      keys[k] = false;
    }
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);

    function bindBtn(btn, key) {
      function pd(e) { e.preventDefault(); keys[key] = true; }
      function pu(e) { e.preventDefault(); keys[key] = false; }
      btn.addEventListener('pointerdown', pd);
      btn.addEventListener('pointerup', pu);
      btn.addEventListener('pointercancel', pu);
      btn.addEventListener('pointerleave', pu);
    }
    bindBtn(dpl, 'a');
    bindBtn(dpr, 'd');
    bindBtn(dj, ' ');

    var FB_OK = (typeof firebase !== 'undefined' && firebase.database && window.FB_READY);
    var mpReady = FB_OK;
    var STALE_MS = 15000;
    var mpKey = (state.player ? 'u' + state.player.id : 'a' + Math.random().toString(36).slice(2, 10));
    var playersRef = FB_OK ? firebase.database().ref('games/' + gameId + '/players') : null;
    var myRef = FB_OK && playersRef ? playersRef.child(mpKey) : null;
    var chatRef = FB_OK ? firebase.database().ref('games/' + gameId + '/chat') : null;
    if (myRef) myRef.onDisconnect().remove();
    if (!FB_OK) {
      console.error('Firebase not available. Multiplayer disabled.', window.FB_ERROR || 'firebase SDK missing');
    }

    function applyPlayer(pid, p) {
      if (pid === mpKey) return;
      if (!p) return;
      if (!otherEls[pid]) {
        var ow = el('div', 'other');
        var nm = el('div', 'nm', escapeHtml(p.name || 'player'));
        var oi = el('img');
        oi.src = 'character.png';
        oi.alt = '';
        oi.draggable = false;
        ow.appendChild(nm);
        ow.appendChild(oi);
        client.appendChild(ow);
        otherEls[pid] = ow;
        otherTargets[pid] = { x: (p.x / 100) * WORLD_W, y: (p.y / 100) * WORLD_H, face: p.face || 1, dispX: (p.x / 100) * WORLD_W, dispY: (p.y / 100) * WORLD_H };
        var otherSkin = p.skin && typeof p.skin === 'object' ? {
          head: typeof p.skin.head === 'string' ? p.skin.head : DEFAULT_SKIN.head,
          torso: typeof p.skin.torso === 'string' ? p.skin.torso : DEFAULT_SKIN.torso,
          legs: typeof p.skin.legs === 'string' ? p.skin.legs : DEFAULT_SKIN.legs,
          arms: typeof p.skin.arms === 'string' ? p.skin.arms : DEFAULT_SKIN.arms
        } : DEFAULT_SKIN;
        (function (imgEl) {
          getSpriteUrl(otherSkin, function (url) { imgEl.src = url; });
        })(oi);
      }
      if (!otherTargets[pid]) {
        otherTargets[pid] = { x: (p.x / 100) * WORLD_W, y: (p.y / 100) * WORLD_H, face: p.face || 1, dispX: (p.x / 100) * WORLD_W, dispY: (p.y / 100) * WORLD_H };
      }
      otherTargets[pid].x = (p.x / 100) * WORLD_W;
      otherTargets[pid].y = (p.y / 100) * WORLD_H;
      otherTargets[pid].face = p.face || 1;
    }

    if (playersRef) {
      playersRef.on('child_added', function (snap) {
        var pid = snap.key;
        var p = snap.val();
        if (!p || pid === mpKey) return;
        applyPlayer(pid, p);
        updateChatVisibility();
      });
      playersRef.on('child_changed', function (snap) {
        var pid = snap.key;
        var p = snap.val();
        if (!p || pid === mpKey) return;
        applyPlayer(pid, p);
      });
      playersRef.on('child_removed', function (snap) {
        var pid = snap.key;
        if (pid === mpKey) return;
        if (otherEls[pid]) { otherEls[pid].remove(); delete otherEls[pid]; }
        delete otherTargets[pid];
        updateChatVisibility();
      });
    }
    function updateChatVisibility() {
      var otherCount = 0;
      for (var k in otherEls) { otherCount++; break; }
      if (chatWrap) {
        if (otherCount > 0) {
          chatWrap.style.display = '';
        } else {
          chatWrap.style.display = 'none';
          chatWrap.classList.remove('open');
          if (chatInput) chatInput.value = '';
        }
      }
    }

    function leaveMultiplayer() {
      try { myRef.remove(); } catch (e) {}
    }
    window.addEventListener('beforeunload', leaveMultiplayer);

    moveTimer = setInterval(sendMove, 100);

    var chatWrap = el('div', 'chat-wrap');
    chatWrap.style.display = 'none';
    var chatPanel = el('div', 'chat-panel');
    var chatMessages = el('div', 'chat-messages');
    var chatEmpty = el('div', 'chat-empty', 'No messages yet.');
    chatMessages.appendChild(chatEmpty);
    chatPanel.appendChild(chatMessages);
    chatWrap.appendChild(chatPanel);
    var chatBar = el('button', 'chat-bar', 'Click here to start chatting');
    chatWrap.appendChild(chatBar);
    var chatRow = el('div', 'chat-row');
    var chatInput = el('input', 'chat-input');
    chatInput.maxLength = 200;
    chatInput.placeholder = 'Say something...';
    chatInput.autocomplete = 'off';
    var chatSend = el('button', 'chat-send', 'Send');
    chatRow.appendChild(chatInput);
    chatRow.appendChild(chatSend);
    chatWrap.appendChild(chatRow);
    client.appendChild(chatWrap);

    function addChatMessage(name, text) {
      if (chatEmpty.parentElement) chatEmpty.remove();
      var row = el('div', name === 'System' ? 'chat-msg system' : 'chat-msg');
      row.appendChild(el('span', 'chat-msg-name', escapeHtml(name) + ': '));
      row.appendChild(el('span', 'chat-msg-text', escapeHtml(text)));
      chatMessages.appendChild(row);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function openChat() {
      chatWrap.classList.add('open');
      chatInput.focus();
    }
    function closeChat() {
      chatWrap.classList.remove('open');
    }
    chatBar.onclick = openChat;
    chatInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (document.activeElement !== chatSend) closeChat();
      }, 120);
    });
    chatInput.addEventListener('keyup', function (e) { e.stopPropagation(); });

    function sendChat() {
      var text = chatInput.value.trim();
      chatInput.value = '';
      if (!text) { closeChat(); return; }
      var name = state.player ? state.player.username : 'player';
      var msgText = text.slice(0, 200);
      if (!chatRef) {
        var hint = !window.FB_READY ? ('Firebase config error: ' + (window.FB_ERROR || 'init failed')) : 'Firebase SDK missing';
        addChatMessage('System', 'Chat unavailable. ' + hint + '. Open browser console (F12) for details.');
        closeChat();
        return;
      }
      chatRef.push({
        name: name,
        text: msgText,
        ts: firebase.database.ServerValue.TIMESTAMP
      }).catch(function (err) {
        addChatMessage('System', 'Message failed: ' + (err && err.code ? err.code : 'unknown error'));
      });
      closeChat();
    }
    chatSend.onclick = function (e) { e.preventDefault(); sendChat(); };
    chatInput.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
      else if (e.key === 'Escape') { chatInput.value = ''; closeChat(); }
    });

    if (chatRef) chatRef.limitToLast(50).on('child_added', function (snap) {
      var m = snap.val();
      if (!m) return;
      addChatMessage(m.name || 'player', m.text || '');
    });

    var playPanActive = false;
    var playPanLastX = 0, playPanLastY = 0;
    var playPinchDist = 0;
    var playTwoFinger = false;
    var playPanMidX = 0, playPanMidY = 0;
    function playCtxMenu(e) { e.preventDefault(); }
    function playPointerDown(e) {
      if (e.button === 2 || e.buttons === 2) {
        playPanActive = true;
        playPanLastX = e.clientX;
        playPanLastY = e.clientY;
        e.preventDefault();
      }
    }
    function playPointerMove(e) {
      if (playPanActive) {
        var dx = e.clientX - playPanLastX;
        var dy = e.clientY - playPanLastY;
        playPanLastX = e.clientX;
        playPanLastY = e.clientY;
        camX -= dx / scale;
        camY -= dy / scale;
      }
    }
    function playPointerUp(e) {
      if (e.button === 2 || playPanActive) {
        playPanActive = false;
      }
    }
    client.addEventListener('contextmenu', playCtxMenu);
    client.addEventListener('pointerdown', playPointerDown);
    window.addEventListener('pointermove', playPointerMove);
    window.addEventListener('pointerup', playPointerUp);
    client.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        playTwoFinger = true;
        var t1 = e.touches[0], t2 = e.touches[1];
        var ddx = t1.clientX - t2.clientX;
        var ddy = t1.clientY - t2.clientY;
        playPinchDist = Math.sqrt(ddx * ddx + ddy * ddy);
        playPanMidX = (t1.clientX + t2.clientX) / 2;
        playPanMidY = (t1.clientY + t2.clientY) / 2;
        e.preventDefault();
      }
    }, { passive: false });
    client.addEventListener('touchmove', function (e) {
      if (playTwoFinger && e.touches.length === 2) {
        var t1 = e.touches[0], t2 = e.touches[1];
        var newDx = t1.clientX - t2.clientX;
        var newDy = t1.clientY - t2.clientY;
        var newDist = Math.sqrt(newDx * newDx + newDy * newDy);
        if (playPinchDist > 0 && newDist > 0) {
          var ratio = newDist / playPinchDist;
          zoomLevel = Math.max(0.3, Math.min(3, zoomLevel * ratio));
          playPinchDist = newDist;
          measure();
        }
        var midX = (t1.clientX + t2.clientX) / 2;
        var midY = (t1.clientY + t2.clientY) / 2;
        var dx = midX - playPanMidX;
        var dy = midY - playPanMidY;
        playPanMidX = midX;
        playPanMidY = midY;
        camX -= dx / scale;
        camY -= dy / scale;
        e.preventDefault();
      }
    }, { passive: false });
    client.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) playTwoFinger = false;
    });

    measure();
    rafId = requestAnimationFrame(step);

    function cleanup() {
      stopPolling = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (moveTimer) clearInterval(moveTimer);
      if (pollTimer) clearInterval(pollTimer);
      try { if (playersRef) playersRef.off(); if (chatRef) chatRef.off(); } catch (e) {}
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('beforeunload', leaveMultiplayer);
      client.removeEventListener('contextmenu', playCtxMenu);
      client.removeEventListener('pointerdown', playPointerDown);
      window.removeEventListener('pointermove', playPointerMove);
      window.removeEventListener('pointerup', playPointerUp);
      for (var k in otherEls) { otherEls[k].remove(); }
      otherEls = {};
      others = {};
      leaveMultiplayer();
      if (scriptWorker) { try { scriptWorker.terminate(); } catch (e) {} scriptWorker = null; }
      clearGui();
    }
    playCleanup = cleanup;

    backBtn.onclick = function () {
      cleanup();
      playCleanup = null;
      go('games');
    };
  }

  function renderAdmin() {
      var wrap = el('div');
      wrap.appendChild(el('h1', 'page-title', 'Admin <img src="https://i.imgur.com/KpCvMuf.png" style="width:36px;height:36px;object-fit:contain;vertical-align:middle;margin-left:8px;">'));
    
      if (!state.player || !state.player.is_admin) {
        wrap.appendChild(el('div', 'empty-state', 'Admin access required.'));
        return wrap;
      }

      var menu = el('div', 'admin-menu');
    
      var UsersBtn = el('button', 'btn', 'Users');
      UsersBtn.onclick = function() { go('adm_users'); };
      menu.appendChild(UsersBtn);
    
      var GamesBtn = el('button', 'btn', 'Games');
      GamesBtn.onclick = function() { go('adm_games'); };
      menu.appendChild(GamesBtn);
    
      var InvitesBtn = el('button', 'btn', 'Invite Keys');
      InvitesBtn.onclick = function() {go('adm_invites');};
      menu.appendChild(InvitesBtn);

      var PermsBtn = el('button', 'btn', 'Permissions');
      PermsBtn.onclick = function() {go('adm_perms');};
      menu.appendChild(PermsBtn);
        
      wrap.appendChild(menu);
      
      return wrap;
  }

  function renderAdmUsers() {

  }
  function renderAdmGames() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Games'));
    if (!state.gamesLoaded) {
      wrap.appendChild(el('div', 'empty-state', 'Loading games...'));
      return wrap;
    }
    if (!state.games.length) {
      wrap.appendChild(el('div', 'empty-state', 'No games yet. Click Create to build one.'));
      return wrap;
    }
    var grid = el('div', 'games-grid');
    state.games.forEach(function (g) {
      grid.appendChild(renderAdmCard(g));
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderAdmCard(g) {
      var card = el('div', 'game-card');
      var pv = el('div', 'game-preview');
      (g.blocks || []).forEach(function (b) {
        var blk = el('div', 'pv-block');
        blk.style.left = (b.x / WORLD_W * 100) + '%';
        blk.style.top = (b.y / WORLD_H * 100) + '%';
        blk.style.width = (BLOCK / WORLD_W * 100) + '%';
        blk.style.aspectRatio = '1 / 1';
        if (b.type === 'spawn') return;
        if (b.type === 'kill') { blk.classList.add('kill'); blk.style.background = '#dc2626'; }
        else if (b.type === 'ladder') { blk.classList.add('ladder'); blk.style.background = ''; }
        else { blk.style.background = b.color || '#737373'; }
        pv.appendChild(blk);
      });
      var ch = el('div', 'pv-char');
      ch.style.left = '4%';
      ch.style.bottom = '8%';
      pv.appendChild(ch);
      card.appendChild(pv);
      var body = el('div', 'body');
      body.appendChild(el('div', 'title', escapeHtml(g.title)));
      body.appendChild(el('div', 'desc', escapeHtml(g.description || 'No description.')));
      body.appendChild(el('div', 'meta', 'by ' + escapeHtml(g.owner_name || 'unknown')));
      var actions = el('div', 'actions');
      var del = el('button', 'btn', 'Delete');
      del.onclick = function () {
          if (confirm('Delete game "' + escapeHtml(g.title) + '"?')) {
              deleteGame(g.id);
          }
    };
    actions.appendChild(del);
    
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function deleteGame(id) {
      fetch('?api=games&action=admin_delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id })
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
            loadGames().then(function() {
                render();
            });
        } else {
            alert('Failed to delete game: ' + (data.error || 'unknown error'));
        }
      })
      .catch(err => {
          alert('Error deleting game: ' + err.message);
      });
  }


  function renderAdmPerms() {

  }

  function renderInvKeys() {
    var wrap = el('div');
    wrap.appendChild(el('h1', 'page-title', 'Invite Keys'));
    if (!state.player || !state.player.is_admin) {
      wrap.appendChild(el('div', 'empty-state', 'Admin access required.'));
      return wrap;
    }
    var controls = el('div', 'admin-controls');
    var countI = el('input', 'input admin-count');
    countI.type = 'number';
    countI.value = '1';
    countI.min = '1';
    countI.max = '20';
    var genBtn = el('button', 'btn black', 'Generate');
    controls.appendChild(el('span', '', 'How many:'));
    controls.appendChild(countI);
    controls.appendChild(genBtn);
    wrap.appendChild(controls);
    var freshBox = el('div', 'admin-fresh');
    wrap.appendChild(freshBox);
    var list = el('div', 'admin-keys');
    list.appendChild(el('div', 'empty-state', 'Loading...'));
    wrap.appendChild(list);
    function refresh() {
      api('?api=invite&action=list').then(function (res) {
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!res.json || !res.json.ok) {
          list.appendChild(el('div', 'empty-state', 'Failed to load keys.'));
          return;
        }
        var keys = res.json.keys || [];
        if (!keys.length) {
          list.appendChild(el('div', 'empty-state', 'No invite keys yet. Generate some above.'));
          return;
        }
        keys.forEach(function (k) {
          var row = el('div', 'admin-key-row' + (k.used ? ' used' : ''));
          var kTxt = el('span', 'admin-key-txt', k.invkey);
          row.appendChild(kTxt);
          var status = el('span', 'admin-key-status', k.used ? ('used by ' + (k.used_by || '?')) : 'available');
          row.appendChild(status);
          var copyBtn = el('button', 'btn sm', 'Copy');
          copyBtn.onclick = function () {
            try {
              navigator.clipboard.writeText(k.invkey);
              copyBtn.textContent = 'Copied!';
              setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
            } catch (e) {}
          };
          row.appendChild(copyBtn);
          if (!k.used) {
            var delBtn = el('button', 'btn sm', 'Delete');
            delBtn.onclick = function () {
              if (!confirm('Delete this key?')) return;
              api('?api=invite&action=delete', { method: 'POST', body: encode({ id: k.id }) }).then(refresh).catch(refresh);
            };
            row.appendChild(delBtn);
          }
          list.appendChild(row);
        });
      }).catch(function () {
        while (list.firstChild) list.removeChild(list.firstChild);
        list.appendChild(el('div', 'empty-state', 'Network error.'));
      });
    }
    genBtn.onclick = function () {
      var n = Math.max(1, Math.min(20, parseInt(countI.value, 10) || 1));
      genBtn.disabled = true;
      genBtn.textContent = '...';
      api('?api=invite&action=generate', { method: 'POST', body: encode({ count: n }) }).then(function (res) {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate';
        if (res.json && res.json.ok && res.json.keys && res.json.keys.length) {
          while (freshBox.firstChild) freshBox.removeChild(freshBox.firstChild);
          freshBox.appendChild(el('div', '', 'New keys (copy these):'));
          res.json.keys.forEach(function (k) {
            var line = el('div', 'admin-fresh-key');
            line.appendChild(el('span', 'admin-key-txt', k));
            var cb = el('button', 'btn sm', 'Copy');
            cb.onclick = function () {
              try {
                navigator.clipboard.writeText(k);
                cb.textContent = 'Copied!';
                setTimeout(function () { cb.textContent = 'Copy'; }, 1200);
              } catch (e) {}
            };
            line.appendChild(cb);
            freshBox.appendChild(line);
          });
          refresh();
        }
      }).catch(function () {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate';
      });
    };
    refresh();
    return wrap;
  }

  function renderAuthPage(tab) {
    var wrap = el('div', 'auth-page');
    var card = el('div', 'auth-card');
    card.appendChild(el('h1', 'auth-title', 'epikbuild'));

    var tabs = el('div', 'tabs');
    var tSignin = el('button', 'tab', 'Sign in');
    var tSignup = el('button', 'tab', 'Sign up');
    tabs.appendChild(tSignin);
    tabs.appendChild(tSignup);
    card.appendChild(tabs);

    var err = el('div', 'modal-error');

    var fUser = el('div', 'field');
    fUser.appendChild(el('label', '', 'Username'));
    var userI = el('input', 'input');
    userI.maxLength = 32;
    userI.autocomplete = 'username';
    fUser.appendChild(userI);
    card.appendChild(fUser);

    var fPass = el('div', 'field');
    fPass.appendChild(el('label', '', 'Password'));
    var passI = el('input', 'input');
    passI.type = 'password';
    passI.autocomplete = 'current-password';
    fPass.appendChild(passI);
    card.appendChild(fPass);

    var fConf = el('div', 'field');
    fConf.appendChild(el('label', '', 'Confirm password'));
    var confI = el('input', 'input');
    confI.type = 'password';
    fConf.appendChild(confI);
    card.appendChild(fConf);

    var fInvite = el('div', 'field');
    fInvite.appendChild(el('label', '', 'Invite key'));
    var inviteI = el('input', 'input');
    inviteI.type = 'text';
    inviteI.autocomplete = 'off';
    inviteI.placeholder = 'XXXX-XXXX-XXXX-XXXX';
    fInvite.appendChild(inviteI);
    card.appendChild(fInvite);

    card.appendChild(err);
    var submit = el('button', 'btn black', 'Sign in');
    card.appendChild(submit);

    var blurb = el('div', 'auth-blurb');
    blurb.appendChild(el('p', '', 'Hello, this is my first 2d building game sandbox enjoy and make games :P'));

    wrap.appendChild(card);
    wrap.appendChild(blurb);

    var mode = tab || 'signin';
    function setMode(m) {
      mode = m;
      if (m === 'signin') {
        tSignin.classList.add('active');
        tSignup.classList.remove('active');
        fConf.style.display = 'none';
        fInvite.style.display = 'none';
        submit.textContent = 'Sign in';
      } else {
        tSignup.classList.add('active');
        tSignin.classList.remove('active');
        fConf.style.display = 'flex';
        fInvite.style.display = 'flex';
        submit.textContent = 'Sign up';
      }
      hideError(err);
    }
    setMode(mode);
    tSignin.onclick = function () { setMode('signin'); };
    tSignup.onclick = function () { setMode('signup'); };

    function submitIt() {
      var u = userI.value.trim();
      var p = passI.value;
      if (!u || !p) { showError(err, 'Fill in all fields.'); return; }
      if (mode === 'signup') {
        if (p.length < 4) { showError(err, 'Password must be at least 4 characters.'); return; }
        if (p !== confI.value) { showError(err, 'Passwords do not match.'); return; }
        var ik = inviteI.value.trim();
        submit.disabled = true;
        submit.textContent = '...';
        api('?api=auth&action=signup', {
          method: 'POST',
          body: encode({ username: u, password: p, invkey: ik })
        }).then(function (res) {
          submit.disabled = false;
          if (res.json && res.json.ok) {
            state.player = res.json.player;
            go('games');
          } else {
            setMode(mode);
            var e = (res.json && res.json.error) || 'signup_failed';
            showError(err, errText(e));
          }
        }).catch(function () {
          submit.disabled = false;
          setMode(mode);
          showError(err, 'network_error');
        });
      } else {
        submit.disabled = true;
        submit.textContent = '...';
        api('?api=auth&action=signin', {
          method: 'POST',
          body: encode({ username: u, password: p })
        }).then(function (res) {
          submit.disabled = false;
          if (res.json && res.json.ok) {
            state.player = res.json.player;
            go('games');
          } else {
            setMode(mode);
            var e2 = (res.json && res.json.error) || 'signin_failed';
            showError(err, errText(e2));
          }
        }).catch(function () {
          submit.disabled = false;
          setMode(mode);
          showError(err, 'network_error');
        });
      }
    }
    submit.onclick = submitIt;
    passI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    confI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    inviteI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    userI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    userI.focus();
    return wrap;
  }

  function openAuthModal(tab, after) {
    var backdrop = el('div', 'modal-backdrop');
    var wrap = el('div', 'modal-wrap');
    var modal = el('div', 'modal');
    var close = el('button', 'close-x', 'X');
    modal.appendChild(el('h2', '', 'epikbuild'));
    var tabs = el('div', 'tabs');
    var tSignin = el('button', 'tab', 'Sign in');
    var tSignup = el('button', 'tab', 'Sign up');
    tabs.appendChild(tSignin);
    tabs.appendChild(tSignup);
    modal.appendChild(tabs);

    var err = el('div', 'modal-error');

    var fUser = el('div', 'field');
    fUser.appendChild(el('label', '', 'Username'));
    var userI = el('input', 'input');
    userI.maxLength = 32;
    userI.autocomplete = 'username';
    fUser.appendChild(userI);
    modal.appendChild(fUser);

    var fPass = el('div', 'field');
    fPass.appendChild(el('label', '', 'Password'));
    var passI = el('input', 'input');
    passI.type = 'password';
    passI.autocomplete = 'current-password';
    fPass.appendChild(passI);
    modal.appendChild(fPass);

    var fConf = el('div', 'field');
    fConf.appendChild(el('label', '', 'Confirm password'));
    var confI = el('input', 'input');
    confI.type = 'password';
    fConf.appendChild(confI);
    modal.appendChild(fConf);

    var fInvite = el('div', 'field');
    fInvite.appendChild(el('label', '', 'Invite key'));
    var inviteI = el('input', 'input');
    inviteI.type = 'text';
    inviteI.autocomplete = 'off';
    inviteI.placeholder = 'XXXX-XXXX-XXXX-XXXX';
    fInvite.appendChild(inviteI);
    modal.appendChild(fInvite);

    modal.appendChild(err);
    var submit = el('button', 'btn black', 'Sign in');
    modal.appendChild(submit);
    wrap.appendChild(modal);
    wrap.appendChild(close);
    backdrop.appendChild(wrap);
    document.body.appendChild(backdrop);

    var mode = tab || 'signin';
    function setMode(m) {
      mode = m;
      if (m === 'signin') {
        tSignin.classList.add('active');
        tSignup.classList.remove('active');
        fConf.style.display = 'none';
        fInvite.style.display = 'none';
        submit.textContent = 'Sign in';
      } else {
        tSignup.classList.add('active');
        tSignin.classList.remove('active');
        fConf.style.display = 'flex';
        fInvite.style.display = 'flex';
        submit.textContent = 'Sign up';
      }
      hideError(err);
    }
    setMode(mode);
    tSignin.onclick = function () { setMode('signin'); };
    tSignup.onclick = function () { setMode('signup'); };
    close.onclick = function () { backdrop.remove(); };
    backdrop.onclick = function (e) { if (e.target === backdrop) backdrop.remove(); };

    function submitIt() {
      var u = userI.value.trim();
      var p = passI.value;
      if (!u || !p) { showError(err, 'Fill in all fields.'); return; }
      if (mode === 'signup') {
        if (p.length < 4) { showError(err, 'Password must be at least 4 characters.'); return; }
        if (p !== confI.value) { showError(err, 'Passwords do not match.'); return; }
        var ik = inviteI.value.trim();
        submit.disabled = true;
        submit.textContent = '...';
        api('?api=auth&action=signup', {
          method: 'POST',
          body: encode({ username: u, password: p, invkey: ik })
        }).then(function (res) {
          submit.disabled = false;
          if (res.json && res.json.ok) {
            state.player = res.json.player;
            backdrop.remove();
            if (after) after(); else render();
          } else {
            setMode(mode);
            var e = (res.json && res.json.error) || 'signup_failed';
            showError(err, errText(e));
          }
        }).catch(function () {
          submit.disabled = false;
          setMode(mode);
          showError(err, 'network_error');
        });
      } else {
        submit.disabled = true;
        submit.textContent = '...';
        api('?api=auth&action=signin', {
          method: 'POST',
          body: encode({ username: u, password: p })
        }).then(function (res) {
          submit.disabled = false;
          if (res.json && res.json.ok) {
            state.player = res.json.player;
            backdrop.remove();
            if (after) after(); else render();
          } else {
            setMode(mode);
            var e2 = (res.json && res.json.error) || 'signin_failed';
            showError(err, errText(e2));
          }
        }).catch(function () {
          submit.disabled = false;
          setMode(mode);
          showError(err, 'network_error');
        });
      }
    }
    submit.onclick = submitIt;
    passI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    confI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    inviteI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    userI.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitIt(); });
    userI.focus();
  }

  function doSignout() {
    api('?api=auth&action=signout', { method: 'POST' }).then(function () {
      state.player = null;
      go('auth');
    }).catch(function () { go('auth'); });
  }

  function showError(node, msg) {
    node.textContent = msg;
    node.classList.add('show');
  }
  function hideError(node) {
    node.textContent = '';
    node.classList.remove('show');
  }
  function errText(code) {
    var m = {
      'username_invalid': 'Username must be 3-32 letters, numbers, or underscore.',
      'username_taken': 'That username is already taken.',
      'password_short': 'Password must be at least 4 characters.',
      'invalid_credentials': 'Wrong username or password.',
      'invite_required': 'Invite key is required.',
      'invite_invalid': 'Invalid invite key.',
      'invite_used': 'That invite key has already been used.',
      'admin_required': 'Admin access required.',
      'network_error': 'Network error. Try again.'
    };
    return m[code] || code;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return map[c];
    });
  }

  window.addEventListener('beforeunload', function () {
    if (playCleanup) playCleanup();
  });

  Promise.all([loadMe(), loadGames()]).then(function () {
    if (!state.player) {
      go('auth');
    } else {
      render();
    }
  });
})();