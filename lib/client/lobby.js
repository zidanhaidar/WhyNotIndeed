/* WNI lobby: brand header, game cards with illustrated logos. mount() returns a cleanup function. */
import XDS from '@/games/excel-dungeon/sprites.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  function $(s) { return document.querySelector(s); }

  function faceAt(level, mood, x, y, w) {
    return A.face(level, mood).replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + (w * 120 / 140).toFixed(1) + '" ');
  }
  function sprite(inner, x, y, w) {
    return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + w + '" viewBox="0 0 40 40">' + inner + '</svg>';
  }
  function blk(x, y, c) {
    return '<rect x="' + x + '" y="' + y + '" width="19" height="19" rx="3" fill="' + c + '"/><rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="13" height="3" rx="1" fill="rgba(255,255,255,.4)"/>';
  }

  // ---------- logos (300 x 170) ----------

  function logoBury() {
    var C = { I: '#4FB3D9', O: '#F2C14E', T: '#B07CC6', S: '#7CC47F', Z: '#E8644A', J: '#6384DA', L: '#F09A4A' };
    var s = '<defs><radialGradient id="lg-b" cx=".5" cy=".25" r=".9"><stop offset="0" stop-color="#2B7D5E"/><stop offset="1" stop-color="#123A2D"/></radialGradient></defs>' +
      '<rect width="300" height="170" fill="url(#lg-b)"/>';
    var rows = [
      [150, [[40, 'J'], [60, 'J'], [80, 'Z'], [100, 'Z'], [120, 'O'], [140, 'O'], [160, 'S'], [180, 'S'], [220, 'L'], [240, 'I']]],
      [130, [[40, 'J'], [60, 'T'], [80, 'T'], [100, 'T'], [120, 'O'], [140, 'O'], [160, 'Z'], [200, 'L'], [220, 'L'], [240, 'I']]],
      [110, [[60, 'T'], [100, 'S'], [120, 'S'], [140, 'S'], [160, 'Z'], [220, 'Z'], [240, 'I']]]
    ];
    rows.forEach(function (r) { r[1].forEach(function (b) { s += blk(b[0], r[0], C[b[1]]); }); });
    s += faceAt('pip', 'worried', 108, 47, 76);
    // falling piece with speed lines
    s += '<g opacity=".95">' + blk(36, 24, C.Z) + blk(56, 24, C.Z) + blk(56, 44, C.Z) + blk(76, 44, C.Z) + '</g>' +
      '<path d="M44 6 v12 M66 4 v14 M86 22 v14" stroke="#F4EFE1" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>';
    // a dealt card
    s += '<g transform="rotate(12 248 52)"><rect x="224" y="20" width="48" height="66" rx="6" fill="#F4EFE1"/>' +
      '<text x="231" y="36" font-family="Bowlby One, Arial Black, sans-serif" font-size="13" fill="#B07CC6">T</text></g>';
    s += '<g transform="rotate(12 248 52)"><rect x="236" y="52" width="9" height="9" rx="2" fill="#B07CC6"/><rect x="245" y="52" width="9" height="9" rx="2" fill="#B07CC6"/><rect x="254" y="52" width="9" height="9" rx="2" fill="#B07CC6"/><rect x="245" y="43" width="9" height="9" rx="2" fill="#B07CC6"/></g>';
    return s;
  }

  function logoFool() {
    var s = '<rect width="300" height="170" fill="#1B2A47"/>';
    var band = '';
    for (var x = -20; x < 320; x += 48) band += '<path d="M' + x + ' 0 h16 l-10 12 h-16 z" fill="#C7372F"/><path d="M' + (x + 24) + ' 0 h16 l-10 12 h-16 z" fill="#2C4A9A"/>';
    s += '<g>' + band + '</g><g transform="translate(0 158)">' + band + '</g>';
    s += '<g transform="rotate(-7 105 95)"><rect x="34" y="46" width="146" height="96" rx="5" fill="#FBFAF6"/><path d="M34 50 l73 44 l73 -44" fill="none" stroke="#D9E1EE" stroke-width="3"/>' +
      '<rect x="148" y="54" width="22" height="26" rx="2" fill="#F6E7C8" stroke="#C7372F" stroke-width="2" stroke-dasharray="3 2"/>' +
      '<text x="96" y="132" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="58" fill="#1D2647">3</text>' +
      '<rect x="112" y="92" width="9" height="9" fill="#1D2647"/><rect x="112" y="102" width="9" height="9" fill="#1D2647"/><path d="M112 92 l9 0 l0 -1" stroke="#C7372F" stroke-width="2"/></g>';
    s += faceAt('gridlock', 'surprised', 194, 74, 88);
    s += '<path d="M214 28 h66 a8 8 0 0 1 8 8 v24 a8 8 0 0 1 -8 8 h-30 l-10 10 l1 -10 h-27 a8 8 0 0 1 -8 -8 v-24 a8 8 0 0 1 8 -8 z" fill="#fff"/>' +
      '<text x="247" y="60" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="26" fill="#C7372F">8?</text>';
    return s;
  }

  function logoDungeon() {
    var s = '<rect width="300" height="170" fill="#4B2E83"/>';
    var cw = 32, ch = 28, ox = 22, oy = 22;
    var map = [
      'WWWWWWWWW',
      'W..c....W',
      'W.......W',
      'WWW..$..W',
      'W.......W'
    ];
    map.forEach(function (row, r) {
      row.split('').forEach(function (t, c) {
        var x = ox + c * cw, y = oy + r * ch;
        if (t === 'W') s += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" fill="#2E9E5B"/><rect x="' + x + '" y="' + y + '" width="' + cw + '" height="5" fill="#57C985"/>';
        else s += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" fill="#F3FAF5" stroke="#CDE8D5"/>';
      });
    });
    {
      s += sprite(XDS.hero(), ox + 1 * cw - 12, oy + 2 * ch - 26, 58);
      s += sprite(XDS.monster('cut', true), ox + 6 * cw - 12, oy + 2 * ch - 28, 60);
      s += sprite(XDS.item('potion'), ox + 3 * cw - 8, oy + 1 * ch - 14, 46);
      s += sprite(XDS.item('cash'), ox + 4 * cw - 8, oy + 3 * ch - 14, 46);
    }
    s += '<rect x="214" y="44" width="40" height="16" rx="8" fill="#1D1A33"/><text x="234" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="11" fill="#fff">#REF!</text>';
    s += '<g font-family="Arial, sans-serif" font-size="9" fill="#C9B8EE">' + 'ABCDEFGHI'.split('').map(function (c, i) { return '<text x="' + (ox + i * cw + cw / 2) + '" y="15" text-anchor="middle">' + c + '</text>'; }).join('') + '</g>';
    return s;
  }

  function logoSock() {
    var s = '<rect width="300" height="170" fill="#1F9C8E"/>';
    for (var y = 0; y < 170; y += 34) for (var x = (y / 34) % 2 ? 34 : 0; x < 300; x += 68) s += '<rect x="' + x + '" y="' + y + '" width="34" height="34" fill="#28AE9F"/>';
    // dust
    [[40, 30], [66, 128], [250, 140], [214, 30], [120, 150], [268, 70]].forEach(function (d) { s += '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="3.2" fill="#0E6B60"/><circle cx="' + (d[0] + 6) + '" cy="' + (d[1] + 3) + '" r="2" fill="#0E6B60"/>'; });
    // clean trail
    s += '<path d="M20 98 H132" stroke="#7FE0D2" stroke-width="40" stroke-linecap="round" opacity=".55"/>';
    // chair
    s += '<g transform="translate(206 44) rotate(8)"><rect x="0" y="0" width="54" height="16" rx="6" fill="#3D86F0" stroke="#1D1A33" stroke-width="3"/><rect x="4" y="18" width="46" height="34" rx="8" fill="#5B9BF5" stroke="#1D1A33" stroke-width="3"/>' +
      '<circle cx="8" cy="60" r="5" fill="#1D1A33"/><circle cx="46" cy="60" r="5" fill="#1D1A33"/></g>';
    // cable
    s += '<path d="M170 168 C180 140 150 128 170 112 S200 100 196 82" fill="none" stroke="#1D1A33" stroke-width="6" stroke-linecap="round"/><path d="M170 168 C180 140 150 128 170 112 S200 100 196 82" fill="none" stroke="#FFC93C" stroke-width="2.5" stroke-linecap="round"/>';
    // sock
    s += '<g transform="translate(230 104) rotate(-24)"><path d="M0 0 h22 v30 a12 12 0 0 1 -12 12 h-22 a9 9 0 0 1 0 -18 h12 z" fill="#fff" stroke="#1D1A33" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M0 8 h22 M0 16 h22" stroke="#FF6B57" stroke-width="4"/></g>';
    // the vacuum
    s += '<g transform="translate(118 96)"><ellipse cx="4" cy="6" rx="46" ry="44" fill="#1D1A33"/><circle r="46" fill="#F2F2F7" stroke="#1D1A33" stroke-width="3"/><circle r="34" fill="#E8577E"/>' +
      '<circle r="34" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3"/><path d="M-30 -30 a42 42 0 0 1 60 0" fill="none" stroke="#1D1A33" stroke-width="3"/></g>';
    s += faceAt('edith', 'smug', 90, 70, 56);
    return s;
  }

  function logoKick() {
    var s = '<rect width="300" height="170" fill="#EF6C2B"/>';
    for (var x = 0; x < 300; x += 50) s += '<rect x="' + x + '" y="112" width="25" height="58" fill="#5FB548"/><rect x="' + (x + 25) + '" y="112" width="25" height="58" fill="#6DC454"/>';
    s += '<rect y="108" width="300" height="6" fill="#1D1A33"/>';
    // crowd dots
    for (var i = 0; i < 40; i++) s += '<circle cx="' + (8 + i * 7.4) + '" cy="' + (14 + (i % 3) * 7) + '" r="3" fill="' + ['#FFD9C2', '#FFE27A', '#fff'][i % 3] + '" opacity=".6"/>';
    // goal and net
    s += '<g><rect x="60" y="34" width="180" height="80" fill="#fff" opacity=".22"/>';
    for (var nx = 60; nx <= 240; nx += 12) s += '<path d="M' + nx + ' 34 V114" stroke="#fff" stroke-width="1.2" opacity=".6"/>';
    for (var ny = 34; ny <= 114; ny += 12) s += '<path d="M60 ' + ny + ' H240" stroke="#fff" stroke-width="1.2" opacity=".6"/>';
    s += '<path d="M60 116 V34 H240 V116" fill="none" stroke="#1D1A33" stroke-width="10" stroke-linejoin="round"/><path d="M60 116 V34 H240 V116" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></g>';
    // diving keeper
    s += '<g transform="translate(118 76) rotate(-28)"><rect x="-28" y="-6" width="56" height="26" rx="10" fill="#7E97C9" stroke="#1D1A33" stroke-width="3"/>' +
      '<circle cx="-36" cy="4" r="8" fill="#FFE27A" stroke="#1D1A33" stroke-width="3"/><circle cx="36" cy="4" r="8" fill="#FFE27A" stroke="#1D1A33" stroke-width="3"/></g>';
    s += faceAt('gridlock', 'surprised', 96, 38, 46);
    // ball
    s += '<path d="M236 136 l-40 -60" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9" opacity=".9"/>' +
      '<g transform="translate(200 62)"><circle r="17" fill="#fff" stroke="#1D1A33" stroke-width="3"/><path d="M0 -7 l6.6 4.8 -2.5 7.8 h-8.2 l-2.5 -7.8 z" fill="#1D1A33"/></g>';
    return s;
  }

  function logoHangman() {
    var s = '<rect width="300" height="170" fill="#B83B7D"/>';
    for (var i = 0; i < 14; i++) s += '<circle cx="' + ((i * 53) % 300) + '" cy="' + ((i * 37) % 120) + '" r="2" fill="#FFD45C" opacity=".7"/>';
    // balloons
    var bl = [[150, 34, '#FFD45C'], [124, 44, '#3D86F0'], [176, 44, '#2FBF71'], [138, 18, '#FF6B57']];
    bl.forEach(function (b) { s += '<path d="M' + b[0] + ' ' + (b[1] + 16) + ' L150 92" stroke="#1D1A33" stroke-width="2"/>'; });
    bl.forEach(function (b) { s += '<ellipse cx="' + b[0] + '" cy="' + b[1] + '" rx="14" ry="17" fill="' + b[2] + '" stroke="#1D1A33" stroke-width="3"/><ellipse cx="' + (b[0] - 5) + '" cy="' + (b[1] - 6) + '" rx="3" ry="5" fill="#fff" opacity=".6"/>'; });
    // popped one
    s += '<g transform="translate(200 22)" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"><path d="M-8 -8 l-6 -6 M8 -8 l6 -6 M0 -12 v-8 M-10 4 l-8 2 M10 4 l8 2"/></g>';
    s += faceAt('edith', 'worried', 126, 84, 50);
    // word tiles
    var w = ['', 'A', '', '', 'E'];
    w.forEach(function (c, k) {
      var x = 70 + k * 34;
      s += '<rect x="' + x + '" y="134" width="28" height="30" rx="5" fill="#fff" stroke="#1D1A33" stroke-width="3"/>' +
        (c ? '<text x="' + (x + 14) + '" y="157" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="19" fill="#1D1A33">' + c + '</text>' : '<path d="M' + (x + 7) + ' 156 h14" stroke="#1D1A33" stroke-width="3"/>');
    });
    s += '<g transform="translate(250 120) rotate(10)"><rect x="-17" y="-17" width="34" height="34" rx="6" fill="#FFD45C" stroke="#1D1A33" stroke-width="3"/><text y="9" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="22" fill="#1D1A33">?</text></g>';
    return s;
  }

  function sheep(x, y, sc, flip) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -sc : sc) + ' ' + sc + ')">' +
      '<path d="M-14 8 v8 M10 8 v8" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M-20 0 a8 8 0 0 1 8 -10 a9 9 0 0 1 16 -2 a8 8 0 0 1 12 6 a7 7 0 0 1 -2 14 h-28 a7 7 0 0 1 -6 -8 z" fill="#fff" stroke="#1D1A33" stroke-width="3"/>' +
      '<ellipse cx="20" cy="-2" rx="7" ry="8" fill="#1D1A33"/><circle cx="22" cy="-4" r="1.6" fill="#fff"/></g>';
  }

  function logoHerd() {
    var s = '<rect width="300" height="170" fill="#4E9F3D"/>';
    s += '<path d="M0 40 Q80 20 160 38 T300 30 V0 H0 Z" fill="#9AD7F0"/><circle cx="262" cy="22" r="13" fill="#FFE27A"/>';
    for (var i = 0; i < 18; i++) s += '<path d="M' + ((i * 47) % 290 + 5) + ' ' + (60 + (i * 29) % 100) + ' l4 -8 l4 8" fill="none" stroke="#3E8A2F" stroke-width="2.5" stroke-linecap="round"/>';
    // pen
    s += '<g stroke="#1D1A33" stroke-width="3"><rect x="214" y="70" width="72" height="80" fill="#7CC468" stroke-dasharray="0"/></g>' +
      '<g fill="none" stroke="#8B5A2B" stroke-width="7" stroke-linecap="round"><path d="M214 70 H286 V150 H214 V126"/><path d="M214 70 V94"/></g>';
    s += sheep(250, 108, 0.9) + sheep(108, 96, 1) + sheep(140, 124, 0.95, true) + sheep(84, 132, 0.85) + sheep(160, 84, 0.8);
    // dog
    s += '<g transform="translate(40 92)"><path d="M-18 4 q-10 -10 -4 -18" fill="none" stroke="#1D1A33" stroke-width="5" stroke-linecap="round"/><path d="M-18 4 q-10 -10 -4 -18" fill="none" stroke="#B5651D" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="-20" y="-4" width="34" height="18" rx="8" fill="#B5651D" stroke="#1D1A33" stroke-width="3"/><path d="M-14 14 v9 M8 14 v9" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="18" cy="-8" r="11" fill="#B5651D" stroke="#1D1A33" stroke-width="3"/><path d="M12 -16 l-6 -8 l10 2" fill="#5C3310" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="21" cy="-10" r="2" fill="#1D1A33"/><circle cx="29" cy="-6" r="3" fill="#1D1A33"/><rect x="8" y="0" width="16" height="5" rx="2" fill="#FF6B57"/></g>';
    s += '<path d="M62 76 q6 -6 12 0 M66 66 q10 -10 20 0" fill="none" stroke="#FFE27A" stroke-width="3" stroke-linecap="round"/>';
    return s;
  }

  function logoCoffee() {
    var s = '<rect width="300" height="170" fill="#7A4A2C"/>';
    for (var y = 12; y < 170; y += 22) s += '<path d="M0 ' + y + ' q75 6 150 0 t150 0" fill="none" stroke="#6A3F24" stroke-width="3"/>';
    // laptop
    s += '<g transform="translate(196 104)"><rect x="0" y="0" width="86" height="54" rx="6" fill="#C9D3DC" stroke="#1D1A33" stroke-width="3"/><rect x="7" y="7" width="72" height="40" rx="3" fill="#3D86F0"/>' +
      '<path d="M-8 56 h102 l-8 10 h-86 z" fill="#E4E9EE" stroke="#1D1A33" stroke-width="3" stroke-linejoin="round"/><path d="M28 24 l8 8 M36 24 l-8 8 M52 24 l8 8 M60 24 l-8 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>';
    // tipped cup and stream
    s += '<g transform="translate(46 34) rotate(-70)"><path d="M-16 -18 h32 l-4 36 h-24 z" fill="#fff" stroke="#1D1A33" stroke-width="3" stroke-linejoin="round"/><path d="M-12 -6 h24" stroke="#E8504A" stroke-width="5"/></g>';
    s += '<path d="M62 40 C90 46 96 70 100 92 S120 128 132 130" fill="none" stroke="#3B2314" stroke-width="13" stroke-linecap="round"/><path d="M62 40 C90 46 96 70 100 92 S120 128 132 130" fill="none" stroke="#9B5B32" stroke-width="7" stroke-linecap="round"/>';
    // drawn wall
    s += '<path d="M150 86 L200 118" stroke="#1D1A33" stroke-width="9" stroke-linecap="round"/><path d="M150 86 L200 118" stroke="#FFC93C" stroke-width="5" stroke-linecap="round"/>';
    // mug
    s += '<g transform="translate(120 122)"><path d="M0 0 h40 v30 a8 8 0 0 1 -8 8 h-24 a8 8 0 0 1 -8 -8 z" fill="#2FBF71" stroke="#1D1A33" stroke-width="3"/><path d="M40 8 a9 9 0 0 1 0 18" fill="none" stroke="#1D1A33" stroke-width="5"/>' +
      '<rect x="3" y="3" width="34" height="8" rx="3" fill="#5C3310"/></g>';
    s += '<g fill="#9B5B32" stroke="#3B2314" stroke-width="2"><circle cx="150" cy="40" r="5"/><circle cx="172" cy="56" r="4"/><circle cx="120" cy="20" r="4"/></g>';
    return s;
  }


  function logoCopycat() {
    var s = '<rect width="300" height="170" fill="#2D5BE3"/>';
    s += '<path d="M60 0 L20 170 M240 0 L280 170" stroke="#FF7AC8" stroke-width="40" opacity=".18"/>';
    // the light-up floor in perspective
    var cols = ['#FF6B57', '#322A6E', '#FF7AC8', '#2A2360', '#FFC93C', '#322A6E'];
    for (var r = 0; r < 4; r++) {
      var y0 = 92 + r * 19, y1 = y0 + 19, sh = 0.62 + r * 0.13;
      for (var c = 0; c < 7; c++) {
        var x0 = 150 + (c - 3.5) * 40 * sh, x1 = 150 + (c - 2.5) * 40 * sh, x2 = 150 + (c - 2.5) * 40 * (sh + 0.13), x3 = 150 + (c - 3.5) * 40 * (sh + 0.13);
        s += '<path d="M' + x0.toFixed(1) + ' ' + y0 + ' L' + x1.toFixed(1) + ' ' + y0 + ' L' + x2.toFixed(1) + ' ' + y1 + ' L' + x3.toFixed(1) + ' ' + y1 + ' Z" fill="' + cols[(r * 3 + c) % cols.length] + '" stroke="#1D1A33" stroke-width="2"/>';
      }
    }
    // disco ball
    s += '<path d="M150 0 V18" stroke="#1D1A33" stroke-width="2"/><circle cx="150" cy="32" r="16" fill="#D7DCE4" stroke="#1D1A33" stroke-width="2.5"/><path d="M134 32 h32 M150 16 v32 M138 22 h24 M138 42 h24" stroke="#9AA3AD" stroke-width="1.5"/>';
    // you, mid-move, and the robot doing the same move a beat later
    s += '<g transform="translate(96 84)"><ellipse cx="0" cy="22" rx="16" ry="5" fill="#000" opacity=".3"/><circle r="19" fill="#FF6B57" stroke="#1D1A33" stroke-width="3"/>' +
      '<path d="M-17 -6 a17 17 0 0 1 34 0" fill="none" stroke="#1D1A33" stroke-width="4"/><circle cx="-6" cy="0" r="2.6" fill="#1D1A33"/><circle cx="6" cy="0" r="2.6" fill="#1D1A33"/><path d="M-6 7 q6 6 12 0" fill="none" stroke="#1D1A33" stroke-width="2.4"/>' +
      '<path d="M16 -6 l14 -16" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/></g>';
    s += '<g transform="translate(206 84)"><ellipse cx="0" cy="22" rx="16" ry="5" fill="#000" opacity=".3"/><rect x="-21" y="-19" width="42" height="40" rx="10" fill="#7E97C9" stroke="#1D1A33" stroke-width="3"/></g>';
    s += faceAt('gridlock', 'smug', 188, 68, 36);
    s += '<path d="M226 78 l12 -12" stroke="#1D1A33" stroke-width="4" stroke-linecap="round" stroke-dasharray="3 5"/>';
    // the move tape
    ['↑', '→', '→'].forEach(function (a, i) {
      s += '<g transform="translate(' + (66 + i * 30) + ' 22) rotate(' + (i - 1) * 5 + ')"><rect x="-12" y="-12" width="24" height="24" rx="5" fill="' + (i === 2 ? '#FFC93C' : '#fff') + '" stroke="#1D1A33" stroke-width="2.5"/>' +
        '<text y="6" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="17" fill="#1D1A33">' + a + '</text></g>';
    });
    s += '<text x="268" y="40" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="26" fill="#FFC93C" stroke="#1D1A33" stroke-width="1.5" paint-order="stroke">♫</text>';
    return s;
  }

  function logoEcho() {
    var s = '<rect width="300" height="170" fill="#14173A"/>';
    s += '<rect x="20" y="16" width="260" height="138" rx="8" fill="#05061A" stroke="#2A2F5E" stroke-width="3"/>';
    // ripples
    [26, 48, 72, 98].forEach(function (r, i) { s += '<circle cx="118" cy="92" r="' + r + '" fill="none" stroke="#4FE3D0" stroke-width="3" opacity="' + (0.8 - i * 0.18) + '"/>'; });
    // walls the echo found
    var walls = [[70, 50, 70, 110], [70, 50, 130, 50], [160, 60, 160, 130], [100, 130, 160, 130], [190, 40, 190, 100], [190, 100, 240, 100], [40, 80, 70, 80]];
    walls.forEach(function (w, i) {
      s += '<path d="M' + w[0] + ' ' + w[1] + ' L' + w[2] + ' ' + w[3] + '" stroke="#4FE3D0" stroke-width="6" stroke-linecap="round" opacity="' + (i < 4 ? 0.95 : 0.4) + '"/>';
    });
    s += '<path d="M100 130 L100 110" stroke="#FF6B57" stroke-width="6" stroke-linecap="round"/>';
    // you
    s += '<circle cx="118" cy="92" r="22" fill="#FF6B57" opacity=".25"/><circle cx="118" cy="92" r="10" fill="#FF6B57" stroke="#1D1A33" stroke-width="3"/>';
    // a keycard and the exit, heard in the distance
    s += '<g transform="translate(222 64) rotate(-10)"><rect x="-15" y="-10" width="30" height="20" rx="4" fill="#FFC93C" stroke="#1D1A33" stroke-width="2.5"/><rect x="-11" y="-6" width="9" height="7" rx="1.5" fill="#1D1A33"/></g>';
    s += '<g transform="translate(250 130)"><path d="M-12 14 V-6 a12 12 0 0 1 24 0 V14 Z" fill="#3A4166" stroke="#1D1A33" stroke-width="2.5"/><circle cx="5" cy="4" r="2" fill="#FFC93C"/></g>';
    s += faceAt('edith', 'smug', 238, 4, 46);
    return s;
  }

  function logoGoingUp() {
    var s = '<rect width="300" height="170" fill="#0E4D5C"/>';
    for (var a = -72; a <= 72; a += 12) s += '<path d="M150 -6 L' + (150 + Math.tan(a * Math.PI / 180) * 190).toFixed(1) + ' 180" stroke="#E0B13B" stroke-width="5" opacity=".13"/>';
    // the tower in cutaway: your shaft, the landing, the robot's shaft
    s += '<rect x="58" y="34" width="184" height="140" fill="#FFF6E3" stroke="#1D1A33" stroke-width="3"/>';
    s += '<rect x="112" y="66" width="76" height="32" fill="#F6E8C8"/><rect x="112" y="130" width="76" height="40" fill="#F6E8C8"/>';
    [66, 98, 130].forEach(function (y) { s += '<path d="M58 ' + y + ' H242" stroke="#1D1A33" stroke-width="3"/>'; });
    s += '<rect x="70" y="34" width="42" height="140" fill="#2B2440"/><rect x="188" y="34" width="42" height="140" fill="#2B2440"/>';
    s += '<path d="M70 34 v140 M112 34 v140 M188 34 v140 M230 34 v140" stroke="#E0B13B" stroke-width="2.5"/>';
    s += '<rect x="74" y="70" width="34" height="25" rx="4" fill="#FF6B57" stroke="#1D1A33" stroke-width="2.5"/><path d="M91 72 v21" stroke="#1D1A33" stroke-width="2"/>';
    s += '<path d="M91 54 l9 10 h-18 z" fill="#E0B13B" stroke="#1D1A33" stroke-width="2"/>';
    s += '<rect x="192" y="102" width="34" height="25" rx="4" fill="#E9B949" stroke="#1D1A33" stroke-width="2.5"/>' + faceAt('pip', 'happy', 194, 103, 30);
    // people waiting, each with the floor they want
    [[128, 'G', '#3D86F0', '#2FBF71'], [150, '5', '#B83B7D', '#EF8A2B'], [172, '3', '#FFC93C', '#E5483A']].forEach(function (p) {
      s += '<rect x="' + (p[0] - 7) + '" y="114" width="14" height="15" rx="5" fill="' + p[2] + '" stroke="#1D1A33" stroke-width="2"/>' +
        '<circle cx="' + p[0] + '" cy="109" r="6" fill="#F2C9A0" stroke="' + p[3] + '" stroke-width="2.5"/>' +
        '<circle cx="' + p[0] + '" cy="76" r="9" fill="#fff" stroke="#1D1A33" stroke-width="2"/>' +
        '<text x="' + p[0] + '" y="80.5" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="12" fill="#1D1A33">' + p[1] + '</text>';
    });
    // the roof and its sign
    s += '<path d="M44 36 L78 10 H222 L256 36 Z" fill="#1D1A33"/>';
    s += '<text x="150" y="30" text-anchor="middle" font-family="Limelight, Georgia, serif" font-size="15" fill="#E0B13B">WNI TOWER</text>';
    return s;
  }

  function logoCable() {
    var s = '<rect width="300" height="170" fill="#C93A2E"/>';
    for (var i = 0; i < 6; i++) s += '<rect x="' + i * 56 + '" y="0" width="28" height="170" fill="#fff" opacity=".18"/><rect x="0" y="' + i * 56 + '" width="300" height="28" fill="#fff" opacity=".18"/>';
    s += '<rect x="26" y="24" width="248" height="128" rx="12" fill="#C98B4E" stroke="#1D1A33" stroke-width="3"/>';
    s += '<path d="M30 60 C120 66 200 52 270 58 M30 104 C110 98 190 112 270 106" stroke="#B87A40" stroke-width="2" fill="none"/>';
    // a power strip and the noodle cables running to it
    s += '<rect x="36" y="34" width="22" height="104" rx="10" fill="#FFF8EC" stroke="#1D1A33" stroke-width="2.5"/>';
    [48, 72, 96, 120].forEach(function (y) { s += '<circle cx="47" cy="' + y + '" r="7" fill="#F1E6D0" stroke="#1D1A33" stroke-width="1.5"/>'; });
    var cables = [['M47 48 C90 48 90 92 130 92 S 180 50 214 52', '#F5C542'], ['M47 72 C80 72 100 128 150 126 S 200 130 232 112', '#F2B33D'], ['M47 96 C70 96 74 66 110 66 S 150 40 170 42', '#6CBF4A']];
    cables.forEach(function (c) {
      s += '<path d="' + c[0] + '" fill="none" stroke="#1D1A33" stroke-width="11" stroke-linecap="round"/><path d="' + c[0] + '" fill="none" stroke="' + c[1] + '" stroke-width="6.5" stroke-linecap="round"/>';
    });
    [[47, 48, '#F5C542'], [47, 72, '#F2B33D'], [47, 96, '#6CBF4A']].forEach(function (p) { s += '<rect x="' + (p[0] - 8) + '" y="' + (p[1] - 8) + '" width="16" height="16" rx="4" fill="' + p[2] + '" stroke="#1D1A33" stroke-width="2"/>'; });
    // the gadgets: a lamp, a monitor and a phone
    s += '<g transform="translate(214 52)"><rect x="-18" y="-18" width="36" height="36" rx="9" fill="#fff" stroke="#1D1A33" stroke-width="2.5"/><path d="M-8 11 h16 M0 11 L-3 -1 L5 -6" fill="none" stroke="#1D1A33" stroke-width="2.5"/><path d="M2 -12 L12 -3 L4 2 Z" fill="#FFD45C" stroke="#1D1A33" stroke-width="2"/></g>';
    s += '<g transform="translate(232 112)"><rect x="-18" y="-18" width="36" height="36" rx="9" fill="#fff" stroke="#1D1A33" stroke-width="2.5"/><rect x="-12" y="-10" width="24" height="15" rx="2" fill="#3D86F0" stroke="#1D1A33" stroke-width="2"/><path d="M0 5 v5 M-6 11 h12" stroke="#1D1A33" stroke-width="2.5"/></g>';
    s += '<g transform="translate(170 42)"><rect x="-15" y="-15" width="30" height="30" rx="8" fill="#fff" stroke="#1D1A33" stroke-width="2.5"/><rect x="-6" y="-11" width="12" height="22" rx="3" fill="#1D1A33"/><rect x="-4" y="-8" width="8" height="14" fill="#4FE3D0"/></g>';
    s += faceAt('edith', 'smug', 238, 132, 40);
    return s;
  }

  function logoClick() {
    var s = '<rect width="300" height="170" fill="#2B2F7A"/>';
    s += '<rect x="30" y="14" width="240" height="142" rx="14" fill="#E9E1C9" stroke="#1D1A33" stroke-width="3"/>';
    s += '<rect x="42" y="24" width="216" height="112" rx="6" fill="#13827F" stroke="#1D1A33" stroke-width="3"/>';
    // two windows, the button they guard, and the robot's pointer going round them
    s += '<rect x="56" y="40" width="78" height="54" rx="5" fill="#FBF8EE" stroke="#1D1A33" stroke-width="2.5"/><rect x="56" y="40" width="78" height="12" rx="5" fill="#3D86F0" stroke="#1D1A33" stroke-width="2.5"/>';
    s += '<rect x="150" y="70" width="70" height="50" rx="5" fill="#FBF8EE" stroke="#1D1A33" stroke-width="2.5"/><rect x="150" y="70" width="70" height="12" rx="5" fill="#B83B7D" stroke="#1D1A33" stroke-width="2.5"/>';
    s += '<circle cx="127" cy="46" r="3.5" fill="#E5483A"/><circle cx="213" cy="76" r="3.5" fill="#FFC93C"/>';
    s += '<rect x="174" y="34" width="66" height="26" rx="7" fill="#E5383B" stroke="#1D1A33" stroke-width="2.5"/>';
    s += '<text x="207" y="51.5" text-anchor="middle" font-family="VT323, Courier New, monospace" font-size="15" fill="#fff">DELETE</text>';
    s += '<path d="M150 64 q14 -26 30 -18" fill="none" stroke="#4FE3B0" stroke-width="3" stroke-dasharray="4 5"/>';
    s += '<g transform="translate(140 60) rotate(-18)"><path d="M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L17 15 Z" fill="#fff" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round"/></g>';
    s += '<text x="150" y="150" text-anchor="middle" font-family="VT323, Courier New, monospace" font-size="15" fill="#8A8068">WNI 3000</text>';
    s += faceAt('edith', 'smug', 238, 112, 46);
    return s;
  }

  function logoBadge() {
    var s = '<rect width="300" height="170" fill="#1E4E8C"/>';
    s += '<path d="M0 132 H300 V170 H0 Z" fill="#8A5A3B"/><path d="M0 132 H300" stroke="#1D1A33" stroke-width="3"/>';
    // a visitor and the badge they hold up
    s += '<path d="M40 170 Q44 128 92 126 Q140 128 144 170 Z" fill="#2FBF71" stroke="#1D1A33" stroke-width="3"/>';
    s += '<ellipse cx="92" cy="86" rx="32" ry="36" fill="#D9A066" stroke="#1D1A33" stroke-width="3"/>';
    s += '<path d="M60 80 Q62 48 92 48 Q122 48 124 80 Q110 64 92 64 Q74 64 60 80 Z" fill="#1D1A33"/>';
    s += '<circle cx="80" cy="88" r="3.5" fill="#1D1A33"/><circle cx="104" cy="88" r="3.5" fill="#1D1A33"/><path d="M82 104 q10 7 20 0" fill="none" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>';
    s += '<path d="M190 0 L196 40 M214 0 L208 40" stroke="#E5483A" stroke-width="6"/>';
    s += '<g transform="translate(202 92) rotate(5)"><rect x="-52" y="-50" width="104" height="96" rx="10" fill="#FFFBEF" stroke="#1D1A33" stroke-width="3"/>';
    s += '<rect x="-52" y="-50" width="104" height="20" rx="10" fill="#133461" stroke="#1D1A33" stroke-width="3"/>';
    s += '<text x="0" y="-35" text-anchor="middle" font-family="Special Elite, Courier New, monospace" font-size="11" fill="#fff">WNI STAFF</text>';
    s += '<rect x="-44" y="-22" width="34" height="40" rx="4" fill="#E8EEF6" stroke="#1D1A33" stroke-width="2"/><circle cx="-27" cy="-6" r="9" fill="#D9A066" stroke="#1D1A33" stroke-width="2"/>';
    s += '<path d="M-2 -16 h40 M-2 -4 h32 M-2 8 h36" stroke="#1D1A33" stroke-width="3"/>';
    s += '<path d="M30 22 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" fill="#2FBF71" stroke="#1D1A33" stroke-width="2" stroke-linejoin="round"/></g>';
    s += faceAt('monolith', 'smug', 14, 10, 44);
    return s;
  }

  function logoSudoku() {
    var s = '<rect width="300" height="170" fill="#A65E00"/>', i;
    for (i = 14; i < 300; i += 14) s += '<path d="M' + i + ' 0 V170" stroke="rgba(255,255,255,.1)" stroke-width="1"/>';
    for (i = 14; i < 170; i += 14) s += '<path d="M0 ' + i + ' H300" stroke="rgba(255,255,255,.1)" stroke-width="1"/>';
    // a paper grid, partly solved: ink for the starting numbers, blue pencil for yours
    s += '<g transform="translate(138 88) rotate(-4)"><rect x="-70" y="-70" width="140" height="140" rx="8" fill="#1D1A33" transform="translate(6 6)"/>';
    s += '<rect x="-70" y="-70" width="140" height="140" rx="8" fill="#FFFDF5" stroke="#1D1A33" stroke-width="3"/>';
    for (i = 1; i < 9; i++) {
      var p = -70 + i * 140 / 9, w = i % 3 ? 1 : 2.6, c = i % 3 ? '#B9C7DD' : '#1D1A33';
      s += '<path d="M' + p.toFixed(1) + ' -70 V70 M-70 ' + p.toFixed(1) + ' H70" stroke="' + c + '" stroke-width="' + w + '"/>';
    }
    s += '<rect x="' + (-70 + 4 * 140 / 9).toFixed(1) + '" y="' + (-70 + 4 * 140 / 9).toFixed(1) + '" width="15.6" height="15.6" fill="#FFE066"/>';
    var digits = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
    for (i = 0; i < 81; i++) {
      if (digits[i] === '.') continue;
      var mine = i % 7 === 3;
      s += '<text x="' + (-70 + (i % 9 + 0.5) * 140 / 9).toFixed(1) + '" y="' + (-70 + ((i / 9 | 0) + 0.5) * 140 / 9 + 4.5).toFixed(1) + '" text-anchor="middle" font-family="Fredoka, Arial Rounded MT Bold, sans-serif" font-weight="600" font-size="12" fill="' + (mine ? '#2F5FD0' : '#1D1A33') + '">' + digits[i] + '</text>';
    }
    s += '</g>';
    // the pencil
    s += '<g transform="translate(236 70) rotate(38)"><rect x="-9" y="-58" width="18" height="92" rx="2" fill="#FFE066" stroke="#1D1A33" stroke-width="3"/><path d="M-3 -58 v92 M3 -58 v92" stroke="#E0B53C" stroke-width="2"/>';
    s += '<rect x="-9" y="-72" width="18" height="16" rx="4" fill="#FF8FB1" stroke="#1D1A33" stroke-width="3"/><path d="M-9 34 L0 56 L9 34 Z" fill="#F2C9A0" stroke="#1D1A33" stroke-width="3" stroke-linejoin="round"/><path d="M-3 48 L0 56 L3 48 Z" fill="#1D1A33"/></g>';
    s += faceAt('gridlock', 'smug', 226, 108, 58);
    return s;
  }

  function logoMines() {
    var s = '<rect width="300" height="170" fill="#46546B"/>', x, y;
    for (y = 8; y < 170; y += 16) for (x = 8; x < 300; x += 16) s += '<circle cx="' + x + '" cy="' + y + '" r="1.3" fill="rgba(255,255,255,.09)"/>';
    // a patch of minefield: raised tiles, open squares with numbers, a flag and a mine
    var rows = ['##21#', '#2.1#', '#1.1F', '#1.2#'], colors = { 1: '#1F5FD0', 2: '#2E8B3A', 3: '#D7263D' }, ox = 40, oy = 26, k = 28;
    s += '<rect x="' + (ox - 6) + '" y="' + (oy - 6) + '" width="' + (5 * k + 12) + '" height="' + (4 * k + 12) + '" rx="6" fill="#1D1A33" transform="translate(6 6)"/>';
    s += '<rect x="' + (ox - 6) + '" y="' + (oy - 6) + '" width="' + (5 * k + 12) + '" height="' + (4 * k + 12) + '" rx="6" fill="#D9DFEA" stroke="#1D1A33" stroke-width="3"/>';
    rows.forEach(function (row, r) {
      row.split('').forEach(function (ch, c) {
        var px = ox + c * k, py = oy + r * k;
        if (ch === '#' || ch === 'F') {
          s += '<rect x="' + px + '" y="' + py + '" width="' + k + '" height="' + k + '" fill="#C3CDDF" stroke="#7D8AA3" stroke-width="1"/><path d="M' + (px + 2) + ' ' + (py + k - 2) + ' V' + (py + 2) + ' H' + (px + k - 2) + '" fill="none" stroke="#F4F7FC" stroke-width="3"/>';
          if (ch === 'F') s += '<path d="M' + (px + 11) + ' ' + (py + 6) + ' v16" stroke="#1D1A33" stroke-width="2.6" stroke-linecap="round"/><path d="M' + (px + 12) + ' ' + (py + 6) + ' l9 4 -9 4 z" fill="#FF5A5F" stroke="#1D1A33" stroke-width="1.6" stroke-linejoin="round"/>';
        } else {
          s += '<rect x="' + px + '" y="' + py + '" width="' + k + '" height="' + k + '" fill="#EEF2F8" stroke="#B5BFD2" stroke-width="1"/>';
          if (ch !== '.') s += '<text x="' + (px + k / 2) + '" y="' + (py + k / 2 + 7) + '" text-anchor="middle" font-family="Silkscreen, Courier New, monospace" font-size="18" fill="' + colors[ch] + '">' + ch + '</text>';
        }
      });
    });
    // the mine that got away, and the classic smiley
    s += '<g transform="translate(232 54)"><g stroke="#1D1A33" stroke-width="5" stroke-linecap="round"><path d="M0 -34 V34 M-34 0 H34 M-24 -24 L24 24 M24 -24 L-24 24"/></g><circle r="22" fill="#1D1A33"/><circle cx="-8" cy="-8" r="6" fill="#FF5A5F"/></g>';
    s += '<g transform="translate(206 104)"><rect width="44" height="44" rx="6" fill="#C3CDDF" stroke="#1D1A33" stroke-width="3"/><circle cx="22" cy="22" r="15" fill="#FFD45C" stroke="#1D1A33" stroke-width="2.6"/><circle cx="17" cy="19" r="2.2" fill="#1D1A33"/><circle cx="27" cy="19" r="2.2" fill="#1D1A33"/><ellipse cx="22" cy="28" rx="3" ry="3.6" fill="#1D1A33"/></g>';
    s += faceAt('edith', 'happy', 238, 112, 54);
    return s;
  }

  var LOOK = {
    'bury-the-bot': { bg: '#1C5A44', accent: '#E2B24C', logo: logoBury, tilt: -1.4,
      pitch: 'You pick the falling blocks. Make the robot run out of room.' },
    'fool-the-model': { bg: '#1B2A47', accent: '#C7372F', logo: logoFool, tilt: -0.8,
      pitch: 'Smudge a few pixels so the sorting robot reads the wrong number.' },
    'excel-dungeon': { bg: '#4B2E83', accent: '#6FD39A', logo: logoDungeon, tilt: 1.3,
      pitch: 'A dungeon crawl through a spreadsheet. Bonk the errors, grab the coffee.' },
    'sock-trap': { logo: logoSock, tilt: 1.2 },
    'spot-kick': { logo: logoKick, tilt: -1.3 },
    'sneaky-hangman': { logo: logoHangman, tilt: 0.9 },
    'herd-instinct': { logo: logoHerd, tilt: -0.9 },
    'coffee-spill': { logo: logoCoffee, tilt: 1.4 },
    copycat: { logo: logoCopycat, tilt: -1.2 },
    echo: { logo: logoEcho, tilt: 1 },
    'going-up': { logo: logoGoingUp, tilt: -1.1 },
    'cable-spaghetti': { logo: logoCable, tilt: 1.3 },
    'dont-click-that': { logo: logoClick, tilt: -1 },
    'badge-check': { logo: logoBadge, tilt: 1.1 },
    sudoku: { logo: logoSudoku, tilt: -1.2 },
    minesweeper: { logo: logoMines, tilt: 1 }
  };
  // colors and pitch come from the shared game list
  A.GAMES.forEach(function (g) {
    var l = LOOK[g.id];
    l.bg = l.bg || g.color;
    l.accent = l.accent || g.accent;
    l.pitch = l.pitch || g.blurb;
  });

  function renderCards() {
    var wrap = $('#cards');
    wrap.innerHTML = '';
    A.GAMES.forEach(function (g, i) {
      var look = LOOK[g.id], pr = A.progress(g.id);
      var cleared = A.LEVELS.filter(function (L) { return pr[L.id] && pr[L.id].stars > 0; }).length;
      var a = document.createElement('a');
      a.className = 'gcard';
      a.href = g.path;
      a.style.setProperty('--g', look.bg);
      a.style.setProperty('--ga', look.accent);
      a.style.setProperty('--tilt', look.tilt + 'deg');
      var done = g.endless ? (cleared ? cleared + ' of 4 starred' : 'Endless') : (cleared ? cleared + ' of 4 cleared' : 'New');
      a.setAttribute('aria-label', g.name + '. ' + look.pitch + ' ' + (g.endless ? cleared + ' of 4 levels starred.' : cleared + ' of 4 levels cleared.'));
      a.innerHTML =
        '<span class="art"><svg viewBox="0 0 300 170" aria-hidden="true">' + look.logo() + '</svg>' + (i < 10 ? '<span class="key">' + ((i + 1) % 10) + '</span>' : '') + '</span>' +
        '<span class="label">' +
        '<span class="title">' + A.esc(g.name) + '</span>' +
        '<span class="pitch">' + A.esc(look.pitch) + '</span>' +
        '<span class="meta"><span class="pegs" aria-hidden="true">' + A.LEVELS.map(function (L) {
          var r = pr[L.id];
          return '<i class="' + (r && r.stars > 0 ? 'on' : '') + '" style="--c:' + L.color + '" title="' + L.name + (r && r.stars > 0 ? ': cleared' : '') + '"></i>';
        }).join('') + '</span><span class="cleared">' + done + '</span><span class="play">Play</span></span>' +
        '</span>';
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(a, g.path);
      });
      wrap.appendChild(a);
    });
    extraCards($('#site-cards'));
  }

  // Two site cards sit in their own row under the games: the leaderboard and your account.
  function extraCards(wrap) {
    wrap.innerHTML = '';
    var u = A.account.user();
    var trophy = '<rect width="300" height="170" fill="#1D1A33"/>' +
      [[40, 30], [262, 40], [70, 130], [236, 132], [150, 18]].map(function (p) { return '<path d="M' + p[0] + ' ' + (p[1] - 8) + ' v16 M' + (p[0] - 8) + ' ' + p[1] + ' h16" stroke="#FFC93C" stroke-width="3" stroke-linecap="round"/>'; }).join('') +
      '<rect x="88" y="120" width="40" height="40" rx="4" fill="#E6EBF5" stroke="#fff" stroke-width="3"/><rect x="128" y="96" width="44" height="64" rx="4" fill="#FFE58A" stroke="#fff" stroke-width="3"/><rect x="172" y="132" width="40" height="28" rx="4" fill="#F6D2B8" stroke="#fff" stroke-width="3"/>' +
      '<text x="150" y="136" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="26" fill="#1D1A33">1</text>' +
      '<path d="M128 34 h44 v20 a22 22 0 0 1 -44 0 z" fill="#FFC93C" stroke="#fff" stroke-width="3"/><path d="M128 40 h-10 a10 10 0 0 0 12 14 M172 40 h10 a10 10 0 0 1 -12 14" fill="none" stroke="#fff" stroke-width="3"/><path d="M150 76 v12 M138 90 h24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
    var crew = '<rect width="300" height="170" fill="#3D86F0"/><circle cx="150" cy="200" r="130" fill="#5B9BF5"/>' +
      faceAt('pip', 'happy', 20, 76, 66) + faceAt('gridlock', 'smug', 86, 56, 66) + faceAt('monolith', 'calm', 152, 56, 66) + faceAt('edith', 'happy', 218, 76, 66) +
      '<path d="M96 22 h108 a10 10 0 0 1 10 10 v12 a10 10 0 0 1 -10 10 h-46 l-8 9 l-1 -9 h-53 a10 10 0 0 1 -10 -10 v-12 a10 10 0 0 1 10 -10 z" fill="#fff" stroke="#1D1A33" stroke-width="3"/>' +
      '<text x="150" y="44" text-anchor="middle" font-family="Bowlby One, Arial Black, sans-serif" font-size="12.5" fill="#1D1A33">' + (u ? 'Hi, ' + A.esc(u.username.slice(0, 12)) + '!' : 'Join the board!') + '</text>';
    [
      { href: '/leaderboard', art: trophy, bg: '#1D1A33', title: 'Leaderboard', pitch: 'Every finished run scores points. See who is on top in each game.', play: 'See ranks', tilt: -1 },
      { href: '/account', art: crew, bg: '#3D86F0', title: u ? 'Your account' : 'Log in or sign up', pitch: u ? 'Your best run in every game, and where it ranks.' : 'Make an account so your scores land on the leaderboard.', play: u ? 'My runs' : 'Sign up', tilt: 1.2 }
    ].forEach(function (c) {
      var a = document.createElement('a');
      a.className = 'gcard site-card';
      a.href = c.href;
      a.style.setProperty('--g', c.bg);
      a.style.setProperty('--ga', '#FFC93C');
      a.style.setProperty('--tilt', c.tilt + 'deg');
      a.innerHTML = '<span class="art"><svg viewBox="0 0 300 170" aria-hidden="true">' + c.art + '</svg></span>' +
        '<span class="label"><span class="title">' + A.esc(c.title) + '</span><span class="pitch">' + A.esc(c.pitch) + '</span>' +
        '<span class="meta"><span class="cleared"></span><span class="play">' + c.play + '</span></span></span>';
      wrap.appendChild(a);
    });
  }

  function renderCast() {
    var moods = { pip: 'happy', gridlock: 'smug', monolith: 'calm', edith: 'happy' };
    var lines = {
      pip: 'Eager and a bit clumsy. The perfect warm-up.',
      gridlock: 'Steady and careful. Makes very few mistakes.',
      monolith: 'Plans ahead and reads your moves. A real fight.',
      edith: 'Small, cheerful, and has never lost. Good luck.'
    };
    $('#cast').innerHTML = A.LEVELS.map(function (L, i) {
      return '<li style="--c:' + L.color + '"><span class="cface">' + A.face(L.id, moods[L.id]) + '</span>' +
        '<span class="cname">' + L.name + '</span><span class="crank">Level ' + (i + 1) + ': ' + L.rank + '</span>' +
        '<span class="cline">' + lines[L.id] + '</span></li>';
    }).join('');
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go(card, path) {
    if (reduce || !card) { A.go(path); return; }
    A.tone(660, 0.1, 'triangle', 0.05);
    A.tone(990, 0.14, 'triangle', 0.04, 0.09);
    card.classList.add('launch');
    sc.timeout(function () { A.go(path); }, 340);
  }

  function soundLabel() {
    var b = $('#btn-sound'), m = $('#btn-music');
    b.innerHTML = A.icon('sound', !A.soundOn()) + '<span>Sound ' + (A.soundOn() ? 'on' : 'off') + '</span>';
    b.setAttribute('aria-pressed', String(A.soundOn()));
    m.innerHTML = A.icon('music', !A.music.on()) + '<span>Music ' + (A.music.on() ? 'on' : 'off') + '</span>';
    m.setAttribute('aria-pressed', String(A.music.on()));
  }
  sc.add(A.onAudioChange(soundLabel));
  $('#btn-sound').addEventListener('click', function () { A.setSound(!A.soundOn()); A.jingle('tick'); });
  $('#btn-music').addEventListener('click', function () { A.music.toggle(); });
  $('#btn-volume').innerHTML = A.icon('volume') + '<span>Volume</span>';
  sc.add(A.volumeControl($('#btn-volume')));
  $('#btn-hide').addEventListener('click', A.toggleBoss);
  sc.add(A.account.chip($('#account')));
  sc.add(A.account.onChange(function () { renderCards(); }));
  A.music.play('lobby');

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!/^[0-9]$/.test(e.key)) return;
    var n = Number(e.key) || 10;
    if (n <= A.GAMES.length) go(document.querySelectorAll('.gcard')[n - 1], A.GAMES[n - 1].path);
  });

  // the back button can restore this page from cache mid-animation
  sc.on(window, 'pageshow', function () { renderCards(); });

  document.querySelectorAll('[data-wni-logo]').forEach(function (el) {
    if (el.querySelector('.wni-logo')) return;
    el.insertAdjacentHTML('afterbegin', A.logo({ compact: el.dataset.wniLogo === 'compact', label: el.tagName === 'H1' ? undefined : false }));
  });

  soundLabel();
  renderCards();
  renderCast();
  return sc.dispose;
}
