<?php
/**
 * Plugin Name: Tapai Agenda
 * Plugin URI:  https://tapai.app
 * Description: Incrusta el widget de reservas Tapai y el calendario público de fechas disponibles con shortcodes.
 * Version:     1.0.0
 * Author:      Tapai
 * Text Domain: tapai-agenda
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TAPAI_AGENDA_VERSION', '1.0.0');
define('TAPAI_AGENDA_OPTION', 'tapai_agenda_settings');

function tapai_agenda_get_settings() {
    $defaults = array(
        'booking_url' => '',
        'default_height' => 700,
        'calendar_height' => 520,
    );
    $settings = get_option(TAPAI_AGENDA_OPTION, array());
    return wp_parse_args($settings, $defaults);
}

function tapai_agenda_register_settings() {
    register_setting(
        'tapai_agenda_settings_group',
        TAPAI_AGENDA_OPTION,
        array(
            'type' => 'array',
            'sanitize_callback' => 'tapai_agenda_sanitize_settings',
            'default' => array(
                'booking_url' => '',
                'default_height' => 700,
                'calendar_height' => 520,
            ),
        )
    );

    add_settings_section(
        'tapai_agenda_main',
        __('Configuración del widget', 'tapai-agenda'),
        'tapai_agenda_settings_section_cb',
        'tapai-agenda'
    );

    add_settings_field(
        'booking_url',
        __('URL del sistema de reservas', 'tapai-agenda'),
        'tapai_agenda_field_booking_url',
        'tapai-agenda',
        'tapai_agenda_main'
    );

    add_settings_field(
        'default_height',
        __('Altura del iframe (px)', 'tapai-agenda'),
        'tapai_agenda_field_default_height',
        'tapai-agenda',
        'tapai_agenda_main'
    );

    add_settings_field(
        'calendar_height',
        __('Altura del calendario (px)', 'tapai-agenda'),
        'tapai_agenda_field_calendar_height',
        'tapai-agenda',
        'tapai_agenda_main'
    );
}
add_action('admin_init', 'tapai_agenda_register_settings');

function tapai_agenda_sanitize_settings($input) {
    $output = array();
    $output['booking_url'] = isset($input['booking_url'])
        ? esc_url_raw(untrailingslashit(trim($input['booking_url'])))
        : '';
    $output['default_height'] = isset($input['default_height'])
        ? max(400, absint($input['default_height']))
        : 700;
    $output['calendar_height'] = isset($input['calendar_height'])
        ? max(360, absint($input['calendar_height']))
        : 520;
    return $output;
}

function tapai_agenda_settings_section_cb() {
    echo '<p>' . esc_html__('Introduce la URL base donde está instalado Tapai (sin barra final). Ejemplo: https://tudominio.com/booking', 'tapai-agenda') . '</p>';
}

function tapai_agenda_field_booking_url() {
    $settings = tapai_agenda_get_settings();
    printf(
        '<input type="url" name="%s[booking_url]" value="%s" class="regular-text" placeholder="https://tudominio.com/booking" />',
        esc_attr(TAPAI_AGENDA_OPTION),
        esc_attr($settings['booking_url'])
    );
}

function tapai_agenda_field_default_height() {
    $settings = tapai_agenda_get_settings();
    printf(
        '<input type="number" name="%s[default_height]" value="%d" min="400" max="2000" step="50" />',
        esc_attr(TAPAI_AGENDA_OPTION),
        absint($settings['default_height'])
    );
}

function tapai_agenda_field_calendar_height() {
    $settings = tapai_agenda_get_settings();
    printf(
        '<input type="number" name="%s[calendar_height]" value="%d" min="360" max="1200" step="20" />',
        esc_attr(TAPAI_AGENDA_OPTION),
        absint($settings['calendar_height'])
    );
}

function tapai_agenda_add_menu() {
    add_options_page(
        __('Tapai Agenda', 'tapai-agenda'),
        __('Tapai Agenda', 'tapai-agenda'),
        'manage_options',
        'tapai-agenda',
        'tapai_agenda_settings_page'
    );
}
add_action('admin_menu', 'tapai_agenda_add_menu');

function tapai_agenda_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <form action="options.php" method="post">
            <?php
            settings_fields('tapai_agenda_settings_group');
            do_settings_sections('tapai-agenda');
            submit_button(__('Guardar cambios', 'tapai-agenda'));
            ?>
        </form>

        <hr>
        <h2><?php esc_html_e('Uso del shortcode', 'tapai-agenda'); ?></h2>
        <p><?php esc_html_e('Widget completo de reservas:', 'tapai-agenda'); ?></p>
        <code>[agendamiento_centro]</code>
        <p><?php esc_html_e('Calendario público de fechas disponibles:', 'tapai-agenda'); ?></p>
        <code>[agendamiento_calendario]</code>
        <p><?php esc_html_e('Atributos opcionales:', 'tapai-agenda'); ?></p>
        <ul style="list-style: disc; margin-left: 20px;">
            <li><code>[agendamiento_centro height="800"]</code> — <?php esc_html_e('cambia la altura del widget', 'tapai-agenda'); ?></li>
            <li><code>[agendamiento_calendario height="520"]</code> — <?php esc_html_e('cambia la altura del calendario', 'tapai-agenda'); ?></li>
            <li><code>[agendamiento_centro url="https://otro-dominio.com/booking"]</code> — <?php esc_html_e('sobreescribe la URL configurada', 'tapai-agenda'); ?></li>
            <li><code>[agendamiento_calendario url="https://otro-dominio.com/booking"]</code> — <?php esc_html_e('misma URL para el calendario', 'tapai-agenda'); ?></li>
        </ul>
    </div>
    <?php
}

function tapai_agenda_resolve_booking_url($atts) {
    $settings = tapai_agenda_get_settings();
    $url = !empty($atts['url']) ? $atts['url'] : $settings['booking_url'];
    return untrailingslashit(esc_url_raw($url));
}

function tapai_agenda_shortcode($atts) {
    $settings = tapai_agenda_get_settings();
    $atts = shortcode_atts(
        array(
            'url' => '',
            'height' => (string) $settings['default_height'],
        ),
        $atts,
        'agendamiento_centro'
    );

    $base_url = tapai_agenda_resolve_booking_url($atts);

    if (empty($base_url)) {
        if (current_user_can('manage_options')) {
            return '<p style="padding:16px;background:#fff3cd;border-radius:8px;color:#856404;">'
                . esc_html__('Tapai Agenda: configura la URL en Ajustes → Tapai Agenda.', 'tapai-agenda')
                . '</p>';
        }
        return '';
    }

    $height = max(400, absint($atts['height']));
    $iframe_src = trailingslashit($base_url) . 'public/';
    $container_id = 'tapai-agenda-' . wp_unique_id();

    return sprintf(
        '<div id="%1$s" class="tapai-agenda-widget" style="width:100%%;max-width:100%%;">'
        . '<iframe src="%2$s" width="100%%" height="%3$d" frameborder="0" '
        . 'style="border:none;border-radius:16px;display:block;max-width:100%%;" '
        . 'title="%4$s" loading="lazy" allow="payment"></iframe>'
        . '</div>',
        esc_attr($container_id),
        esc_url($iframe_src),
        $height,
        esc_attr__('Agendar cita', 'tapai-agenda')
    );
}
add_shortcode('agendamiento_centro', 'tapai_agenda_shortcode');

function tapai_agenda_calendar_shortcode($atts) {
    $settings = tapai_agenda_get_settings();
    $atts = shortcode_atts(
        array(
            'url' => '',
            'height' => (string) $settings['calendar_height'],
        ),
        $atts,
        'agendamiento_calendario'
    );

    $base_url = tapai_agenda_resolve_booking_url($atts);

    if (empty($base_url)) {
        if (current_user_can('manage_options')) {
            return '<p style="padding:16px;background:#fff3cd;border-radius:8px;color:#856404;">'
                . esc_html__('Tapai Agenda: configura la URL en Ajustes → Tapai Agenda.', 'tapai-agenda')
                . '</p>';
        }
        return '';
    }

    $height = max(360, absint($atts['height']));
    $iframe_src = trailingslashit($base_url) . 'public/calendar.html';
    $container_id = 'tapai-agenda-calendar-' . wp_unique_id();

    return sprintf(
        '<div id="%1$s" class="tapai-agenda-calendar-widget" style="width:100%%;max-width:100%%;">'
        . '<iframe src="%2$s" width="100%%" height="%3$d" frameborder="0" '
        . 'style="border:none;border-radius:16px;display:block;max-width:100%%;" '
        . 'title="%4$s" loading="lazy"></iframe>'
        . '</div>',
        esc_attr($container_id),
        esc_url($iframe_src),
        $height,
        esc_attr__('Fechas disponibles', 'tapai-agenda')
    );
}
add_shortcode('agendamiento_calendario', 'tapai_agenda_calendar_shortcode');

function tapai_agenda_block_category($categories) {
    return array_merge(
        $categories,
        array(
            array(
                'slug' => 'tapai',
                'title' => __('Tapai', 'tapai-agenda'),
            ),
        )
    );
}
add_filter('block_categories_all', 'tapai_agenda_block_category', 10, 1);

function tapai_agenda_register_block() {
    if (!function_exists('register_block_type')) {
        return;
    }

    register_block_type('tapai/agenda', array(
        'api_version' => 2,
        'title' => __('Tapai Agenda', 'tapai-agenda'),
        'description' => __('Widget de reservas Tapai', 'tapai-agenda'),
        'category' => 'tapai',
        'icon' => 'calendar-alt',
        'keywords' => array('agenda', 'citas', 'booking', 'tapai'),
        'supports' => array('html' => false),
        'attributes' => array(
            'height' => array(
                'type' => 'number',
                'default' => 700,
            ),
        ),
        'render_callback' => function ($attributes) {
            $height = isset($attributes['height']) ? absint($attributes['height']) : 700;
            return tapai_agenda_shortcode(array('height' => (string) $height));
        },
    ));
}
add_action('init', 'tapai_agenda_register_block');
