<?php
/**
 * Plugin Name: SiteOrigin Widgets Playground Setup
 */

add_action( 'wp_loaded', function() {
	// Clear Page Builder welcome screen.
	delete_transient( 'siteorigin_panels_activation_welcome' );

	// Activate all Widget Bundle Widgets.
	$active_widgets = array(
		'button' => true,
		'google-map' => true,
		'image' => true,
		'slider' => true,
		'post-carousel' => true,
		'editor' => true,
		'accordion' => true,
		'anything-carousel' => true,
		'cta' => true,
		'hero' => true,
		'headline' => true,
		'image-grid' => true,
		'layout-slider' => true,
		'tabs' => true,
		'simple-masonry' => true,
		'testimonial' => true,
		'video' => true,
		'taxonomy' => true,
		'price-table' => true,
		'icon' => true,
		'features' => true,
		'blog' => true,
		'contact' => true,
		'lottie-player' => true,
		'social-media-buttons' => true,
		'mirror-widget' => true,
		'recent-posts' => true,
		'lightbox-builder' => true,
		'button-grid' => true,
		'card-carousel' => true,
		'author-box' => true,
	);
	update_option( 'siteorigin_widgets_active', $active_widgets );
	wp_cache_delete( 'active_widgets', 'siteorigin_widgets' );

	// Deactivate the plugin after running.
	deactivate_plugins( plugin_basename( __FILE__ ) );
}, 10 );
