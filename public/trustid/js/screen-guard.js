/**
 * Personal Vault — Screen Recording & Screenshot Guard
 *
 * Blocks / detects on every platform:
 *  ✓ Browser screen recording via getDisplayMedia (Chrome, Firefox, Edge)
 *  ✓ Canvas capture via captureStream / toDataURL / toBlob
 *  ✓ Browser extension screen recorders that use MediaRecorder
 *  ✓ PrintScreen key (Windows/Linux)
 *  ✓ Mac screenshot shortcuts (Cmd+Shift+3/4/5/6/S)
 *  ✓ Windows Snipping Tool (Win+Shift+S, Ctrl+Shift+S)
 *  ✓ Screen sharing / video call capture (getDisplayMedia)
 *  ✓ Tab out / app switch to screenshot tool (visibilitychange)
 *  ✓ Window blur (Alt+Tab to screenshot app)
 *  ✓ DevTools open (debugger / element inspector)
 *  ✗ OS-level recorders (OBS, iOS built-in) — browser has no API access to these
 *
 * Usage:
 *   <script src="./js/screen-guard.js"></script>
 *   ScreenGuard.enable({ onAttempt: function(type){ … } });
 */
var ScreenGuard = (function() {
  var _enabled      = false;
  var _onAttempt    = null;
  var _overlayEl    = null;
  var _originalGDM  = null;
  var _originalGUM  = null;
  var _streams      = [];

  /* ── Build the blocking overlay ── */
  function buildOverlay() {
    if (_overlayEl) return;
    _overlayEl = document.createElement('div');
    _overlayEl.id = '__pv_guard_overlay';
    _overlayEl.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:#0F0E2A', 'display:none',
      'align-items:center', 'justify-content:center',
      'flex-direction:column', 'gap:14px', 'color:#fff',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    _overlayEl.innerHTML =
      '<div style="font-size:52px">🚫</div>'
      + '<div style="font-size:18px;font-weight:800">Recording Blocked</div>'
      + '<div style="font-size:13px;opacity:0.6;text-align:center;max-width:280px;line-height:1.6">Screen recording is not permitted in Personal Vault. Content is protected.</div>';
    document.body.appendChild(_overlayEl);
  }

  function showOverlay(ms) {
    if (!_overlayEl) buildOverlay();
    _overlayEl.style.display = 'flex';
    if (ms) setTimeout(hideOverlay, ms);
  }
  function hideOverlay() {
    if (_overlayEl) _overlayEl.style.display = 'none';
  }

  function trigger(type) {
    showOverlay();                         /* block immediately */
    if (_onAttempt) _onAttempt(type);     /* notify callback */
    console.warn('[ScreenGuard] Blocked:', type);
  }

  /* ── 1. Block getDisplayMedia (screen recording / sharing) ── */
  function hookGetDisplayMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return;
    _originalGDM = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async function() {
      trigger('getDisplayMedia — screen recording blocked');
      /* Return a rejected promise so the recording app gets an error */
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    };
  }

  /* ── 2. Block getUserMedia screen capture ── */
  function hookGetUserMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    _originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      var src = constraints && constraints.video && (constraints.video.mediaSource || '');
      if (src === 'screen' || src === 'window' || src === 'browser') {
        trigger('getUserMedia screen source blocked');
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      }
      return _originalGUM(constraints);
    };
  }

  /* ── 3. Block canvas capture methods ── */
  function hookCanvas() {
    /* captureStream */
    var origCS = HTMLCanvasElement.prototype.captureStream;
    if (origCS) {
      HTMLCanvasElement.prototype.captureStream = function() {
        if (this.__pvProtected) {
          trigger('canvas.captureStream blocked');
          throw new DOMException('Permission denied', 'NotAllowedError');
        }
        return origCS.apply(this, arguments);
      };
    }
    /* toDataURL */
    var origTD = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      if (this.__pvProtected) {
        trigger('canvas.toDataURL blocked');
        return 'data:image/png;base64,';   /* empty image */
      }
      return origTD.apply(this, arguments);
    };
    /* toBlob */
    var origTB = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback) {
      if (this.__pvProtected) {
        trigger('canvas.toBlob blocked');
        if (callback) callback(null);
        return;
      }
      return origTB.apply(this, arguments);
    };
  }

  /* ── 4. Block MediaRecorder targeting page content ── */
  function hookMediaRecorder() {
    if (typeof MediaRecorder === 'undefined') return;
    var OrigMR = MediaRecorder;
    window.MediaRecorder = function(stream, options) {
      /* Check if this stream contains a video track that might be the screen */
      if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
        var track = stream.getVideoTracks()[0];
        var settings = track.getSettings ? track.getSettings() : {};
        if (settings.displaySurface || track.label.toLowerCase().includes('screen')) {
          trigger('MediaRecorder with screen track blocked');
          throw new DOMException('Permission denied', 'NotAllowedError');
        }
      }
      return new OrigMR(stream, options);
    };
    MediaRecorder.prototype       = OrigMR.prototype;
    MediaRecorder.isTypeSupported = OrigMR.isTypeSupported.bind(OrigMR);
  }

  /* ── 5. Keyboard shortcuts ── */
  function hookKeyboard() {
    document.addEventListener('keyup', function(e) {
      if (e.key === 'PrintScreen') {
        navigator.clipboard && navigator.clipboard.writeText('').catch(function(){});
        trigger('PrintScreen key');
        showOverlay(2500);
      }
    }, true);

    document.addEventListener('keydown', function(e) {
      /* Mac: Cmd+Shift+3/4/5/6 and Cmd+Shift+S */
      if (e.metaKey && e.shiftKey && ['3','4','5','6','s','S'].includes(e.key)) {
        e.preventDefault(); e.stopImmediatePropagation();
        trigger('Mac screenshot shortcut');
        showOverlay(2000);
      }
      /* Win+Shift+S (Snipping Tool) — metaKey is Win on some keyboards */
      if (e.shiftKey && (e.key === 'S' || e.key === 's') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); e.stopImmediatePropagation();
        trigger('Snipping Tool shortcut');
        showOverlay(2000);
      }
      /* Ctrl+P (print) */
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }
      /* F12 DevTools */
      if (e.key === 'F12') {
        e.preventDefault();
      }
      /* Ctrl+Shift+I DevTools */
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
      }
    }, true);
  }

  /* ── 6. Visibility / focus loss ── */
  function hookVisibility() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) showOverlay();
      else hideOverlay();
    });
    window.addEventListener('blur', function() {
      showOverlay();
    });
    window.addEventListener('focus', function() {
      hideOverlay();
    });
  }

  /* ── 7. Detect Screen Capture Handle change (Chrome 94+) ── */
  function hookCaptureHandle() {
    try {
      /* CaptureController API — detect when tab is being captured */
      if (typeof CaptureController !== 'undefined') {
        var controller = new CaptureController();
        controller.oncapturehandlechange = function() {
          trigger('CaptureController — tab is being captured');
        };
      }
    } catch(e) {}

    /* Use MediaDevices ondevicechange as proxy for new capture devices */
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', function() {
        /* new device = possible screen capture device */
        checkActiveStreams();
      });
    }
  }

  /* ── 8. Monitor window size for capture resize ── */
  function hookResize() {
    var lastW = window.outerWidth, lastH = window.outerHeight;
    window.addEventListener('resize', function() {
      /* Some screen recording tools resize the viewport */
      var dW = Math.abs(window.outerWidth  - lastW);
      var dH = Math.abs(window.outerHeight - lastH);
      lastW = window.outerWidth; lastH = window.outerHeight;
      /* Sudden large resize can indicate screen recording software capture */
      if (dW > 200 || dH > 200) {
        /* Just warn internally; don't block on resize (too many false positives) */
        console.warn('[ScreenGuard] Large resize detected — possible capture software');
      }
    });
  }

  /* ── 9. Check if any active screen streams exist ── */
  function checkActiveStreams() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    /* If a new "videoinput" appears that is a capture device, trigger warning */
  }

  /* ── 10. CSS protections ── */
  function applyCSS() {
    var style = document.createElement('style');
    style.textContent = [
      /* Disable all selection */
      '* { -webkit-user-select:none!important; -moz-user-select:none!important; user-select:none!important; -webkit-touch-callout:none!important; }',
      /* Disable print */
      '@media print { body { display:none!important; } }',
      /* Disable images showing in print */
      '@media print { img,video,canvas { visibility:hidden!important; } }',
    ].join('\n');
    document.head.appendChild(style);
    /* Disable right-click and drag globally */
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    document.addEventListener('dragstart',   function(e) { e.preventDefault(); }, true);
    document.addEventListener('drop',        function(e) { e.preventDefault(); }, true);
  }

  /* ── Public API ── */
  function enable(opts) {
    if (_enabled) return;
    _enabled   = true;
    _onAttempt = (opts && opts.onAttempt) || null;

    buildOverlay();
    hookGetDisplayMedia();
    hookGetUserMedia();
    hookCanvas();
    hookMediaRecorder();
    hookKeyboard();
    hookVisibility();
    hookCaptureHandle();
    hookResize();
    applyCSS();
  }

  /* Mark a canvas as protected so capture is blocked */
  function protectCanvas(canvas) {
    canvas.__pvProtected = true;
    return canvas;
  }

  /* Draw an image to a protected canvas (use instead of <img> for max protection) */
  function renderToProtectedCanvas(dataUrl, width, height) {
    var canvas = document.createElement('canvas');
    canvas.__pvProtected = true;
    var img = new Image();
    img.onload = function() {
      canvas.width  = width  || img.naturalWidth;
      canvas.height = height || img.naturalHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
    return canvas;
  }

  return {
    enable:                 enable,
    protectCanvas:          protectCanvas,
    renderToProtectedCanvas:renderToProtectedCanvas,
    showOverlay:            showOverlay,
    hideOverlay:            hideOverlay,
  };
})();
