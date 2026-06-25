var PVAlarms = (function () {
  var timers = {};

  function ask() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then(function(p){ return p === 'granted'; });
  }

  function fire(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: body || 'Personal Vault alarm', icon: '/trustid/icon.svg' });
    }
    if (window.Layout) Layout.toast(title + (body ? ': ' + body : ''), 'warning');
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); setTimeout(function(){ osc.stop(); ctx.close(); }, 450);
    } catch(e) {}
  }

  function schedule(kind, item) {
    if (!item || item.done || item.alarm === false) return;
    var when = item.alarmAt || item.dueDate;
    if (!when) return;
    var at = new Date(when).getTime();
    var delay = at - Date.now();
    if (delay <= 0 || delay > 2147483647) return;
    var key = kind + ':' + item._id;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      fire(kind === 'todo' ? 'Task due' : 'Reminder due', item.title);
      delete timers[key];
    }, delay);
  }

  function scheduleAll(reminders, todos) {
    ask().then(function () {
      (reminders || []).forEach(function(r){ schedule('reminder', r); });
      (todos || []).forEach(function(t){ schedule('todo', t); });
    });
  }

  return { ask: ask, schedule: schedule, scheduleAll: scheduleAll };
})();
