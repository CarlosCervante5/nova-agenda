/**
 * Script de incrustación para sitios externos (WordPress, HTML, etc.)
 *
 * Uso:
 *   <div id="centro-holistico-booking"></div>
 *   <script>window.bookingConfig = { apiBase: 'https://tudominio.com/booking' };</script>
 *   <script src="https://tudominio.com/booking/public/embed.js"></script>
 */

(function () {
  'use strict';

  const config = window.bookingConfig || {};
  var apiBase = (config.apiBase || window.location.origin).replace(/\/$/, '');
  var containerId = config.containerId || 'centro-holistico-booking';
  var height = config.height || '700px';
  var mode = config.mode || 'booking';
  var professionalId = config.professionalId || config.professional || '';

  function initBookingWidget() {
    var container = document.getElementById(containerId);
    if (!container) return;

    var page = mode === 'calendar' ? 'calendar.html' : '';
    var bookingUrl = apiBase + '/public/' + page;
    if (professionalId) {
      bookingUrl += (bookingUrl.indexOf('?') >= 0 ? '&' : '?') + 'professional=' + encodeURIComponent(professionalId);
    }
    var title = mode === 'calendar' ? 'Fechas disponibles' : 'Agendar cita';

    container.innerHTML =
      '<iframe src="' + bookingUrl + '" ' +
      'style="width:100%;min-height:' + height + ';border:none;border-radius:16px;display:block;" ' +
      'frameborder="0" loading="lazy" allow="payment" title="' + title + '"></iframe>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingWidget);
  } else {
    initBookingWidget();
  }
})();
