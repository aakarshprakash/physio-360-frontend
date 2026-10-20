// Applies the saved theme before first paint (external file so the CSP can forbid inline scripts).
try {
  var t = localStorage.getItem('physio360.theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
