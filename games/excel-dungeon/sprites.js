/*
 * Excel Dungeon sprites. Every function returns SVG markup drawn in a 40 x 40 box.
 * Shared by the game and the lobby card art.
 */
(function (global) {
  'use strict';

  var INK = '#1D1A33';
  var shadow = '<ellipse cx="20" cy="36.5" rx="11" ry="2.6" fill="rgba(29,26,51,.18)"/>';

  function hero(mood) {
    var mouth = mood === 'hurt'
      ? '<path d="M18 19.2 q2 -1.4 4 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
      : '<path d="M17.8 18.2 q2.2 1.6 4.4 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
    return shadow +
      '<path d="M11 35 v-8.5 a9 9 0 0 1 18 0 v8.5 z" fill="#3B6FD8"/>' +
      '<path d="M20 22.3 l-2.3 3 l2.3 8.2 l2.3 -8.2 z" fill="#E8504A"/>' +
      '<path d="M16.4 22.6 l3.6 2.1 l3.6 -2.1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="20" cy="14.5" r="7.6" fill="#F6C9A0"/>' +
      '<path d="M12.5 13.8 a7.6 7.6 0 0 1 15 0 q-4 -2.6 -7.5 -1 q-3.6 -1.7 -7.5 1 z" fill="#4A3426"/>' +
      '<circle cx="17.2" cy="15.4" r="1.15" fill="' + INK + '"/><circle cx="22.8" cy="15.4" r="1.15" fill="' + INK + '"/>' + mouth +
      '<g transform="rotate(-38 31 23)"><rect x="29.4" y="9.5" width="4.2" height="17" rx=".6" fill="#FFC93C"/><rect x="29.4" y="7.4" width="4.2" height="3" rx=".8" fill="#F28CA0"/>' +
      '<path d="M29.4 26.5 l2.1 4.4 l2.1 -4.4 z" fill="#F3D7A8"/><path d="M31 29.9 l.5 1 l.5 -1 z" fill="#333"/></g>';
  }

  var MON = {
    typo: { color: '#5CC48A', shape: 'blob' },
    latefee: { color: '#A889E6', shape: 'ghost' },
    invoice: { color: '#F49A3E', shape: 'blob' },
    creep: { color: '#3FB8B0', shape: 'worm' },
    audit: { color: '#7C8FB0', shape: 'cube' },
    cut: { color: '#E8504A', shape: 'spiky' }
  };

  function eyes(cx1, cx2, cy, angry) {
    var e = '<circle cx="' + cx1 + '" cy="' + cy + '" r="3.4" fill="#fff"/><circle cx="' + cx2 + '" cy="' + cy + '" r="3.4" fill="#fff"/>' +
      '<circle cx="' + (cx1 + 0.8) + '" cy="' + (cy + 0.6) + '" r="1.7" fill="' + INK + '"/><circle cx="' + (cx2 + 0.8) + '" cy="' + (cy + 0.6) + '" r="1.7" fill="' + INK + '"/>';
    if (angry) e += '<path d="M' + (cx1 - 3.5) + ' ' + (cy - 5) + ' l6 2.4 M' + (cx2 + 3.5) + ' ' + (cy - 5) + ' l-6 2.4" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>';
    return e;
  }

  function monster(id, awake) {
    var m = MON[id] || MON.typo, c = m.color, out = shadow;
    if (m.shape === 'blob' || m.shape === 'spiky') {
      if (m.shape === 'spiky') out += '<path d="M10 17 l2 -7 l4 5 l4 -7 l4 7 l4 -5 l2 7 z" fill="' + c + '"/>';
      out += '<path d="M7 31 q0 -19 13 -19 q13 0 13 19 q-3 3 -6.5 0 q-3.2 3 -6.5 0 q-3.2 3 -6.5 0 q-3.2 3 -6.5 0 z" fill="' + c + '"/>' +
        '<ellipse cx="14" cy="18" rx="3.5" ry="2.2" fill="#fff" opacity=".35"/>' + eyes(15.5, 24.5, 22, m.shape === 'spiky' || awake) +
        '<path d="M17.5 27.5 q2.5 ' + (awake ? '-1.8' : '1.8') + ' 5 0" stroke="' + INK + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
    } else if (m.shape === 'ghost') {
      out += '<path d="M8 33 v-12 a12 12 0 0 1 24 0 v12 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 z" fill="' + c + '"/>' +
        '<ellipse cx="14.5" cy="15" rx="3" ry="2" fill="#fff" opacity=".35"/>' + eyes(15.5, 24.5, 20, awake) +
        '<ellipse cx="20" cy="26.5" rx="2" ry="' + (awake ? 2.4 : 1.2) + '" fill="' + INK + '"/>';
    } else if (m.shape === 'cube') {
      out += '<rect x="7" y="9" width="26" height="25" rx="5" fill="' + c + '"/><rect x="7" y="9" width="26" height="6" rx="3" fill="#fff" opacity=".22"/>' +
        '<circle cx="15" cy="20" r="4.4" fill="#fff" stroke="' + INK + '" stroke-width="1.4"/><circle cx="25" cy="20" r="4.4" fill="#fff" stroke="' + INK + '" stroke-width="1.4"/>' +
        '<path d="M19.4 20 h1.2" stroke="' + INK + '" stroke-width="1.4"/><circle cx="15.6" cy="20.6" r="1.6" fill="' + INK + '"/><circle cx="25.6" cy="20.6" r="1.6" fill="' + INK + '"/>' +
        '<path d="M16 28.5 h8" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>';
    } else if (m.shape === 'worm') {
      out += '<circle cx="11" cy="27" r="6" fill="' + c + '"/><circle cx="17" cy="24" r="6.5" fill="' + c + '"/><circle cx="25" cy="20" r="8.5" fill="' + c + '"/>' +
        '<path d="M22 12 l-2 -5 M28 12 l2 -5" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="20" cy="7" r="1.4" fill="' + INK + '"/><circle cx="30" cy="7" r="1.4" fill="' + INK + '"/>' +
        eyes(22, 29, 19, awake);
    }
    return out;
  }

  var ITEMS = {
    potion: shadow + '<path d="M11 17 h16 l-2 15.5 a2.4 2.4 0 0 1 -2.4 2.2 h-7.2 a2.4 2.4 0 0 1 -2.4 -2.2 z" fill="#fff" stroke="#6B4A2E" stroke-width="1.6"/>' +
      '<path d="M26.8 20 h3 a3.4 3.4 0 0 1 0 7.4 h-3.6" fill="none" stroke="#6B4A2E" stroke-width="1.6"/><rect x="12" y="17.6" width="14" height="3.4" fill="#7A4A2A"/>' +
      '<path d="M15.5 14 q-2 -3 0 -5.5 M21 14 q-2 -3 0 -5.5" stroke="#9AA3AD" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M15 26 h8" stroke="#E8504A" stroke-width="2" stroke-linecap="round"/>',
    atk: shadow + '<path d="M7 29 h26 v4 h-26 z" fill="#4A4F57"/><path d="M8 28 l3 -10 h17 a4.5 4.5 0 0 1 4.5 4.5 v5.5 z" fill="#E8504A"/>' +
      '<rect x="11" y="20" width="12" height="2" rx="1" fill="#fff" opacity=".55"/><path d="M27 12 l2 -4 M31 14 l4 -2 M30 10 l3 -3" stroke="#FFC93C" stroke-width="1.6" stroke-linecap="round"/>',
    def: shadow + '<path d="M20 5 l12 4.5 v9.5 c0 8.4 -5.2 13.6 -12 16 c-6.8 -2.4 -12 -7.6 -12 -16 v-9.5 z" fill="#3B6FD8"/>' +
      '<path d="M20 8.4 l8.8 3.3 v7.3 c0 6.3 -3.8 10.2 -8.8 12.2 z" fill="#5B8EF0"/>' +
      '<path d="M15 19 l3.5 3.5 l6.5 -7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    cash: shadow + '<circle cx="16" cy="23" r="9" fill="#F2B632" stroke="#C98E12" stroke-width="1.8"/><circle cx="24" cy="19" r="9" fill="#F7C64B" stroke="#C98E12" stroke-width="1.8"/>' +
      '<text x="24" y="23.4" text-anchor="middle" font-size="11" font-weight="700" font-family="Arial, sans-serif" fill="#8A5E00">$</text>',
    stairs: '<rect x="9" y="5" width="22" height="31" rx="2.5" fill="#7A4E33"/><rect x="12" y="8" width="16" height="28" rx="1" fill="#A8714D"/>' +
      '<rect x="12" y="8" width="16" height="28" rx="1" fill="url(#xds-glow)" opacity=".0"/><circle cx="24.5" cy="23" r="1.6" fill="#FFC93C"/>' +
      '<path d="M14.5 13 h11 M14.5 17 h11" stroke="#8B5A3C" stroke-width="1.2"/><path d="M6 36 h28" stroke="#4A3426" stroke-width="2" stroke-linecap="round"/>'
  };

  function item(kind) { return ITEMS[kind] || ''; }

  function wrap(inner, cls) {
    return '<svg class="' + (cls || 'spr') + '" viewBox="0 0 40 40" aria-hidden="true">' + inner + '</svg>';
  }

  var XDS = { hero: hero, monster: monster, item: item, wrap: wrap, MON: MON };
  if (typeof module !== 'undefined' && module.exports) module.exports = XDS;
  else global.XDS = XDS;
})(typeof window !== 'undefined' ? window : this);
