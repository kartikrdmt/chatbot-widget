(function () {
  // currentScript is empty when a loader or tag manager runs the script later,
  // so fall back to finding our own tag.
  var script =
    document.currentScript || document.querySelector('script[src*="widget.js"][data-key]');
  if (!script || window.MyraWidget) return;

  var scriptOrigin = new URL(script.src).origin;

  var POSITIONS = [
    'bottom-right',
    'bottom-left',
    'bottom-center',
    'top-right',
    'top-left',
    'top-center',
    'left-center',
    'right-center',
  ];
  var BUTTON_SIZE = 56;
  var GAP = 16;
  var DEFAULT_ACCENT = '#1b2e5a';

  // option name -> query parameter understood by /embed.
  var APPEARANCE = {
    title: 'title',
    subtitle: 'subtitle',
    greeting: 'greeting',
    placeholder: 'placeholder',
    avatarText: 'avatarText',
    accentColor: 'accent',
    accentTextColor: 'accentText',
    backgroundColor: 'surface',
    chatBackgroundColor: 'raised',
    textColor: 'text',
    mutedColor: 'muted',
    borderColor: 'border',
  };

  // data-* attribute on the script tag -> option name.
  var ATTRIBUTES = {
    'data-key': 'key',
    'data-api-url': 'apiUrl',
    'data-position': 'position',
    'data-offset': 'offset',
    'data-width': 'width',
    'data-height': 'height',
    'data-container': 'container',
    'data-title': 'title',
    'data-subtitle': 'subtitle',
    'data-greeting': 'greeting',
    'data-placeholder': 'placeholder',
    'data-avatar-text': 'avatarText',
    'data-accent-color': 'accentColor',
    'data-accent-text-color': 'accentTextColor',
    'data-background-color': 'backgroundColor',
    'data-chat-background-color': 'chatBackgroundColor',
    'data-text-color': 'textColor',
    'data-muted-color': 'mutedColor',
    'data-border-color': 'borderColor',
  };

  var SAFE_COLOR =
    /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%\/+-]+\))$/i;
  var SAFE_SIZE = /^\d*\.?\d+(px|%|vw|vh|dvh|rem|em)$/;

  var CHAT_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg>';
  var CLOSE_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

  var current = null;

  function toCssSize(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number' || /^\d+$/.test(String(value))) return value + 'px';
    return SAFE_SIZE.test(String(value)) ? String(value) : fallback;
  }

  function parsePlacement(position) {
    var parts = position.split('-');
    if (position === 'left-center' || position === 'right-center') {
      return { vertical: 'center', horizontal: parts[0] };
    }
    return { vertical: parts[0], horizontal: parts[1] };
  }

  function create(options) {
    var widgetKey = options.key || '';
    var apiUrl = (options.apiUrl || '').replace(/\/+$/, '');
    var origin = options.widgetUrl ? new URL(options.widgetUrl).origin : scriptOrigin;
    var offset = parseInt(options.offset, 10);
    if (isNaN(offset)) offset = 24;

    var inlineHost = null;
    if (options.container) {
      inlineHost =
        typeof options.container === 'string'
          ? document.querySelector(options.container)
          : options.container;
      if (!inlineHost) return null;
    }

    var accent =
      options.accentColor && SAFE_COLOR.test(options.accentColor)
        ? options.accentColor
        : DEFAULT_ACCENT;
    var accentText =
      options.accentTextColor && SAFE_COLOR.test(options.accentTextColor)
        ? options.accentTextColor
        : '#fff';

    var stateKey = 'myra.widget.open.' + widgetKey;
    var width = toCssSize(options.width, inlineHost ? '100%' : '380px');
    var height = toCssSize(options.height, inlineHost ? '600px' : '600px');

    var isOpen = false;
    var isLoaded = false;
    var destroyed = false;
    var placement = { vertical: 'bottom', horizontal: 'right' };
    var button = null;
    var frame = null;

    function embedUrl() {
      var query = 'key=' + encodeURIComponent(widgetKey);
      Object.keys(APPEARANCE).forEach(function (name) {
        if (options[name])
          query += '&' + APPEARANCE[name] + '=' + encodeURIComponent(options[name]);
      });
      if (inlineHost) query += '&inline=1';
      return origin + '/embed?' + query;
    }

    function readOpenState() {
      try {
        return sessionStorage.getItem(stateKey) === '1';
      } catch (error) {
        return false;
      }
    }

    function saveOpenState(open) {
      try {
        sessionStorage.setItem(stateKey, open ? '1' : '0');
      } catch (error) {
        // Storage can be blocked; the widget just won't reopen after a refresh.
      }
    }

    function resolvePosition() {
      var fallback =
        options.position && POSITIONS.indexOf(options.position) > -1
          ? options.position
          : 'bottom-right';
      if (!apiUrl) return Promise.resolve(fallback);

      return fetch(apiUrl + '/widget/config?key=' + encodeURIComponent(widgetKey))
        .then(function (response) {
          if (response.status === 403 || response.status === 404) return null;
          return response.ok ? response.json() : {};
        })
        .then(function (config) {
          if (config === null) return null;
          if (options.position) return fallback;
          return config && POSITIONS.indexOf(config.position) > -1 ? config.position : fallback;
        })
        .catch(function () {
          return fallback;
        });
    }

    // Sets one axis of a fixed box: pinned to an edge, or centred with auto margins.
    function place(style, axis, where, distance) {
      var sides = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'];
      var margin = axis === 'x' ? 'marginLeft' : 'marginTop';
      var marginEnd = axis === 'x' ? 'marginRight' : 'marginBottom';
      style[sides[0]] = '';
      style[sides[1]] = '';
      style[margin] = '';
      style[marginEnd] = '';
      if (where === 'center') {
        style[sides[0]] = '0';
        style[sides[1]] = '0';
        style[margin] = 'auto';
        style[marginEnd] = 'auto';
      } else {
        style[where] = distance + 'px';
      }
    }

    function layoutButton() {
      place(button.style, 'x', placement.horizontal, offset);
      place(button.style, 'y', placement.vertical, offset);
    }

    function layoutFrame(expanded) {
      var style = frame.style;
      if (expanded) {
        place(style, 'x', 'left', 0);
        place(style, 'y', 'top', 0);
        style.width = '100vw';
        style.height = '100dvh';
        style.borderRadius = '0';
        style.borderWidth = '0';
        if (button) button.style.display = 'none';
        return;
      }

      var beside = placement.vertical === 'center';
      var step = offset + BUTTON_SIZE + GAP;
      place(style, 'x', placement.horizontal, beside ? step : offset);
      place(style, 'y', placement.vertical, beside ? offset : step);

      var reservedX = beside ? offset + step : offset * 2;
      var reservedY = beside ? offset * 2 : offset + step;
      style.width = 'min(' + width + ',calc(100vw - ' + reservedX + 'px))';
      style.height = 'min(' + height + ',calc(100vh - ' + reservedY + 'px))';
      style.borderRadius = '16px';
      style.borderWidth = '1px';
      if (button) button.style.display = 'flex';
    }

    function setOpen(open) {
      if (!frame || !button) return;
      isOpen = open;
      saveOpenState(open);
      if (open && !isLoaded) {
        isLoaded = true;
        frame.src = embedUrl();
      }
      if (!open) layoutFrame(false);
      frame.style.opacity = open ? '1' : '0';
      frame.style.pointerEvents = open ? 'auto' : 'none';
      frame.style.transform = open ? 'translateY(0)' : 'translateY(12px)';
      button.innerHTML = open ? CLOSE_ICON : CHAT_ICON;
      button.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    }

    function onMessage(event) {
      if (!frame || event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === 'myra-widget:close') setOpen(false);
      if (event.data.type === 'myra-widget:expand') layoutFrame(!!event.data.expanded);
    }

    function mountInline() {
      frame = document.createElement('iframe');
      frame.title = 'Chat widget';
      frame.src = embedUrl();
      frame.style.cssText =
        'display:block;max-width:100%;border:1px solid rgba(128,128,128,.25);border-radius:16px;' +
        'overflow:hidden;background:#fff;color-scheme:light;width:' +
        width +
        ';height:' +
        height +
        ';';
      inlineHost.appendChild(frame);
    }

    function mountFloating(position) {
      placement = parsePlacement(position);

      button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Open chat');
      button.style.cssText =
        'position:fixed;z-index:2147483646;width:' +
        BUTTON_SIZE +
        'px;height:' +
        BUTTON_SIZE +
        'px;border:none;border-radius:50%;cursor:pointer;color:' +
        accentText +
        ';background:' +
        accent +
        ';box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;' +
        'justify-content:center;transition:transform .2s ease;padding:0;';
      button.innerHTML = CHAT_ICON;
      button.onmouseenter = function () {
        button.style.transform = 'scale(1.06)';
      };
      button.onmouseleave = function () {
        button.style.transform = 'scale(1)';
      };
      button.onclick = function () {
        setOpen(!isOpen);
      };

      frame = document.createElement('iframe');
      frame.title = 'Chat widget';
      frame.style.cssText =
        'position:fixed;z-index:2147483647;border:1px solid rgba(128,128,128,.25);' +
        'border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3);' +
        'background:#fff;color-scheme:light;opacity:0;pointer-events:none;' +
        'transform:translateY(12px);' +
        'transition:opacity .2s ease,transform .2s ease,width .3s ease-in-out,' +
        'height .3s ease-in-out,top .3s ease-in-out,bottom .3s ease-in-out,' +
        'left .3s ease-in-out,right .3s ease-in-out,border-radius .3s ease-in-out;';
      layoutButton();
      layoutFrame(false);

      document.body.appendChild(frame);
      document.body.appendChild(button);

      if (readOpenState()) setOpen(true);
    }

    function start() {
      resolvePosition().then(function (position) {
        if (destroyed || !position) return;
        if (inlineHost) mountInline();
        else mountFloating(position);
      });
    }

    window.addEventListener('message', onMessage);
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });

    return {
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false);
      },
      destroy: function () {
        destroyed = true;
        window.removeEventListener('message', onMessage);
        if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
        if (button && button.parentNode) button.parentNode.removeChild(button);
        frame = null;
        button = null;
        if (current === this) current = null;
      },
    };
  }

  window.MyraWidget = {
    /** Mounts a widget and returns { open, close, destroy }, or null if it cannot mount. */
    init: function (options) {
      var instance = create(options || {});
      if (instance) current = instance;
      return instance;
    },
    open: function () {
      if (current) current.open();
    },
    close: function () {
      if (current) current.close();
    },
  };

  // A tag with data-key mounts itself; a tag without one (loaded by the npm
  // package or another loader) only exposes MyraWidget.init.
  if (script.hasAttribute('data-key')) {
    var options = {};
    Object.keys(ATTRIBUTES).forEach(function (attribute) {
      var value = script.getAttribute(attribute);
      if (value !== null) options[ATTRIBUTES[attribute]] = value;
    });
    window.MyraWidget.init(options);
  }
})();
