window.FB_READY = false;
window.FB_ERROR = null;
try {
  var _fbc = JSON.parse(atob('YOURFIREBASECONFIGINBASE64'));
  firebase.initializeApp(_fbc);
  window.FB_READY = true;
} catch (e) {
  window.FB_ERROR = e && e.message ? e.message : String(e);
  console.error('Firebase init failed:', e);
}