=== Tapai Agenda ===
Contributors: tapai
Tags: booking, appointments, agenda, citas, calendar
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: MIT

Incrusta el widget de reservas Tapai en WordPress con un shortcode o bloque Gutenberg.

== Instalación ==

1. Comprime la carpeta `tapai-agenda` en un archivo ZIP.
2. En WordPress ve a Plugins → Añadir nuevo → Subir plugin.
3. Activa el plugin.
4. Ve a Ajustes → Tapai Agenda e introduce la URL base de tu instalación Tapai (ej: https://tudominio.com/booking).
5. Usa el shortcode `[agendamiento_centro]` en cualquier página.

== Shortcode ==

`[agendamiento_centro]`
`[agendamiento_centro height="800"]`
`[agendamiento_centro url="https://tudominio.com/booking"]`

Calendario público de fechas disponibles:

`[agendamiento_calendario]`
`[agendamiento_calendario height="520"]`
`[agendamiento_calendario url="https://tudominio.com/booking"]`

== Bloque Gutenberg ==

Busca "Tapai Agenda" en el editor de bloques y añádelo a tu página.
