const fs = require( 'fs' );
const path = require( 'path' );

const ENV_KEY = 'SO_TESTS_MOUNTED_PLUGIN';

/**
 * Reads the Plugin Name and Version headers from a plugin file.
 *
 * Mirrors WordPress's `get_file_data()` and `_cleanup_header_comment()`,
 * so the version matches what the REST API reports for the same file.
 *
 * @param {string} file Absolute path to the PHP file.
 *
 * @return {Object} `{ name, version }`, each an empty string when absent.
 */
const readPluginHeaders = ( file ) => {
	const handle = fs.openSync( file, 'r' );
	const buffer = Buffer.alloc( 8192 );
	const bytesRead = fs.readSync( handle, buffer, 0, buffer.length, 0 );
	fs.closeSync( handle );

	const data = buffer.toString( 'latin1', 0, bytesRead ).replace( /\r/g, '\n' );

	const readHeader = ( header ) => {
		const match = data.match(
			new RegExp( `^(?:[ \\t]*<\\?(?:php)?)?[ \\t\\/*#@]*${ header }:(.*)$`, 'mi' )
		);

		// PHP treats '0' as empty here too.
		if ( ! match || ! match[ 1 ] || match[ 1 ] === '0' ) {
			return '';
		}

		// PCRE's \s and PHP's trim() character sets.
		return match[ 1 ]
			.replace( /[ \t\n\x0B\f\r]*(?:\*\/|\?>).*/, '' )
			.replace( /^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '' );
	};

	return {
		name: readHeader( 'Plugin Name' ),
		version: readHeader( 'Version' ),
	};
};

/**
 * Finds the plugin's main file: the one top-level PHP file with a
 * Plugin Name header.
 *
 * The slug is that file's name without `.php`. This supports plugins whose
 * main file is named after the plugin, like `so-widgets-bundle.php`. The
 * folder name is not used, as a git worktree is named after its branch.
 *
 * @param {string} dir The plugin directory.
 * @throws {Error} If there isn't exactly one top-level plugin file.
 *
 * @return {Object} `{ slug, file, headers }`.
 */
const findPluginFile = ( dir ) => {
	const candidates = fs.readdirSync( dir )
		.filter( ( name ) => ! name.startsWith( '.' ) && name.endsWith( '.php' ) )
		.filter( ( name ) => fs.statSync( path.join( dir, name ) ).isFile() )
		.map( ( name ) => ( {
			slug: name.slice( 0, -4 ),
			file: path.join( dir, name ),
			headers: readPluginHeaders( path.join( dir, name ) ),
		} ) )
		.filter( ( candidate ) => candidate.headers.name !== '' );

	if ( candidates.length !== 1 ) {
		const found = candidates.map( ( candidate ) => path.basename( candidate.file ) ).join( ', ' ) || 'none';
		throw new Error(
			`Expected one top-level PHP file with a Plugin Name header in "${ dir }", found: ${ found }.`
		);
	}

	return candidates[ 0 ];
};

/**
 * Describes where a plugin directory mounts in Playground, and what
 * WordPress should report for it once it's active.
 *
 * @param {string} mountDir The directory being mounted.
 *
 * @return {Object} `{ vfsPath, expected: { plugin, version } }`. `plugin`
 *                  uses the REST API's format: `<slug>/<file without .php>`.
 */
const describeMount = ( mountDir ) => {
	const { slug, headers } = findPluginFile( mountDir );

	return {
		vfsPath: `/wordpress/wp-content/plugins/${ slug }`,
		expected: {
			plugin: `${ slug }/${ slug }`,
			version: headers.version,
		},
	};
};

/**
 * Fails if Playground isn't running the plugin that `startPlayground()`
 * mounted.
 *
 * If the mount path doesn't match the plugin's slug, the blueprint installs
 * and activates the wordpress.org release instead, and tests pass against
 * it. This compares the active plugin's Version header with the mounted
 * copy's. It can't detect a release that has the same version string, which
 * is why source headers use `dev`.
 *
 * @param {Object} requestUtils Logged-in RequestUtils instance.
 * @param {Object} [env=process.env] Environment to read the mount from.
 * @throws {Error} If the mounted plugin isn't the active one.
 *
 * @return {Promise<boolean>} False when `startPlayground()` didn't mount a
 *                            plugin, true when the check passed.
 */
const verifyMountedPlugin = async ( requestUtils, env = process.env ) => {
	if ( ! env[ ENV_KEY ] ) {
		return false;
	}

	let expected;
	try {
		expected = JSON.parse( env[ ENV_KEY ] );
	} catch ( error ) {
		throw new Error( `${ ENV_KEY } is not valid JSON: ${ error.message }` );
	}

	if (
		! expected ||
		typeof expected.plugin !== 'string' ||
		typeof expected.version !== 'string'
	) {
		throw new Error( `${ ENV_KEY } must have string "plugin" and "version" values.` );
	}

	const expectedText = `${ expected.plugin } (Version: ${ expected.version }, active)`;

	let plugins;
	try {
		plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );
	} catch ( error ) {
		throw new Error( `Couldn't list plugins to confirm ${ expectedText } is running: ${ error.message }` );
	}

	if ( ! Array.isArray( plugins ) ) {
		throw new Error( `Couldn't list plugins to confirm ${ expectedText } is running: unexpected response.` );
	}

	const entry = plugins.find( ( plugin ) => plugin.plugin === expected.plugin );
	const isActive = entry && ( entry.status === 'active' || entry.status === 'network-active' );

	if ( isActive && entry.version === expected.version ) {
		return true;
	}

	const found = entry ?
		`${ entry.plugin } (Version: ${ entry.version }, ${ entry.status })` :
		'not installed';

	throw new Error(
		`Playground is not running the mounted plugin. Expected ${ expectedText }; found ${ found }. ` +
		'The source mount may have fallen back to the wordpress.org release.'
	);
};

module.exports = {
	describeMount,
	verifyMountedPlugin,
};
