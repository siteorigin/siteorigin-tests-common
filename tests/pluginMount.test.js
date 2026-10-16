const { test } = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );

const { describeMount, verifyMountedPlugin } = require( '../playground/pluginMount' );

const makePluginDir = ( name, files ) => {
	const dir = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'so-tests-' ) ), name );
	fs.mkdirSync( dir );
	for ( const [ file, contents ] of Object.entries( files ) ) {
		fs.writeFileSync( path.join( dir, file ), contents );
	}
	return dir;
};

const header = ( name, version ) => `<?php\n/*\nPlugin Name: ${ name }\nVersion: ${ version }\n*/\n`;

const fakeRequestUtils = ( response ) => {
	const calls = [];
	return {
		calls,
		rest: async ( options ) => {
			calls.push( options );
			if ( response instanceof Error ) {
				throw response;
			}
			return response;
		},
	};
};

const env = ( expected ) => ( { SO_TESTS_MOUNTED_PLUGIN: JSON.stringify( expected ) } );
const expected = { plugin: 'so-widgets-bundle/so-widgets-bundle', version: 'dev' };

test( 'a worktree folder mounts at the main file slug', () => {
	const dir = makePluginDir( 'feature-x', {
		'so-widgets-bundle.php': header( 'SiteOrigin Widgets Bundle', 'dev' ),
	} );

	assert.deepEqual( describeMount( dir ), {
		vfsPath: '/wordpress/wp-content/plugins/so-widgets-bundle',
		expected,
	} );
} );

test( 'PHP files without a Plugin Name header are ignored', () => {
	const dir = makePluginDir( 'feature-x', {
		'functions.php': '<?php\n// Version: 9\n',
		'index.php': '<?php\n// Silence is golden.\n',
		'siteorigin-premium.php': header( 'SiteOrigin Premium', 'dev' ),
		'readme.txt': 'Plugin Name: Not PHP\n',
	} );

	assert.equal( describeMount( dir ).vfsPath, '/wordpress/wp-content/plugins/siteorigin-premium' );
} );

test( 'headers are parsed the way WordPress parses them', () => {
	const cases = [
		[ '<?php\n/**\n * Plugin Name: Docblock\n * Version: 1.2.3\n */\n', '1.2.3' ],
		[ '<?\n/*\nPlugin Name: Short tag\nVersion: 2.0.0 */\n', '2.0.0' ],
		[ '<?php\r\n/*\r\nPlugin Name: CRLF\r\nVersion: dev\r\n*/\r\n', 'dev' ],
		[ '<?php\n# Plugin Name: Hash\n# Version:  4.5 ?> trailing\n', '4.5' ],
		[ '<?php\n/*\nPlugin Name: No version\n*/\n', '' ],
		[ '<?php\n/*\nPlugin Name: Zero\nVersion:0\n*/\n', '' ],
	];

	for ( const [ contents, version ] of cases ) {
		const dir = makePluginDir( 'feature-x', { 'example.php': contents } );
		assert.equal( describeMount( dir ).expected.version, version, contents );
	}
} );

test( 'headers after the first 8 KB are ignored', () => {
	const dir = makePluginDir( 'feature-x', {
		'late.php': `<?php\n/*\n${ ' '.repeat( 8192 ) }\nPlugin Name: Late\n*/\n`,
	} );

	assert.throws( () => describeMount( dir ), /found: none/ );
} );

test( 'zero, several or empty Plugin Name headers throw', () => {
	const none = makePluginDir( 'feature-x', { 'index.php': '<?php\n' } );
	assert.throws( () => describeMount( none ), /found: none/ );

	const several = makePluginDir( 'feature-x', {
		'one.php': header( 'One', '1' ),
		'two.php': header( 'Two', '2' ),
	} );
	assert.throws( () => describeMount( several ), /found: one\.php, two\.php/ );

	const empty = makePluginDir( 'feature-x', { 'empty.php': '<?php\n/*\nPlugin Name:\nVersion: 1\n*/\n' } );
	assert.throws( () => describeMount( empty ), /found: none/ );
} );

test( 'the guard does nothing when no plugin was mounted', async () => {
	const requestUtils = fakeRequestUtils( [] );

	assert.equal( await verifyMountedPlugin( requestUtils, {} ), false );
	assert.equal( requestUtils.calls.length, 0 );
} );

test( 'the guard rejects a malformed mount description', async () => {
	const requestUtils = fakeRequestUtils( [] );

	await assert.rejects(
		verifyMountedPlugin( requestUtils, { SO_TESTS_MOUNTED_PLUGIN: '{' } ),
		/not valid JSON/
	);
	await assert.rejects(
		verifyMountedPlugin( requestUtils, env( { plugin: 'x/x' } ) ),
		/string "plugin" and "version"/
	);
} );

test( 'the guard passes when the mounted plugin is installed', async () => {
	for ( const status of [ 'active', 'network-active', 'inactive' ] ) {
		const requestUtils = fakeRequestUtils( [
			{ plugin: 'siteorigin-panels/siteorigin-panels', status: 'active', version: '2.37.0' },
			{ plugin: 'so-widgets-bundle/so-widgets-bundle', status, version: 'dev' },
		] );

		assert.equal( await verifyMountedPlugin( requestUtils, env( expected ) ), true );
		assert.deepEqual( requestUtils.calls, [ { path: '/wp/v2/plugins' } ] );
	}
} );

test( 'the guard fails when the release is running instead', async () => {
	const failures = [
		[
			[ { plugin: 'so-widgets-bundle/so-widgets-bundle', status: 'active', version: '1.75.0' } ],
			'found so-widgets-bundle/so-widgets-bundle (Version: 1.75.0, active)',
		],
		[
			[ { plugin: 'feature-x/so-widgets-bundle', status: 'inactive', version: 'dev' } ],
			'found not installed',
		],
	];

	for ( const [ plugins, found ] of failures ) {
		await assert.rejects( verifyMountedPlugin( fakeRequestUtils( plugins ), env( expected ) ), ( error ) => {
			assert.match( error.message, /Expected so-widgets-bundle\/so-widgets-bundle \(Version: dev\)/ );
			assert.ok( error.message.includes( found ), error.message );
			return true;
		} );
	}
} );

test( 'the guard fails when the plugin list cannot be read', async () => {
	for ( const response of [ new Error( 'Not logged in' ), { code: 'rest_forbidden' } ] ) {
		await assert.rejects(
			verifyMountedPlugin( fakeRequestUtils( response ), env( expected ) ),
			/so-widgets-bundle\/so-widgets-bundle \(Version: dev\)/
		);
	}
} );

test( 'the guard reads the mount from process.env by default', async () => {
	process.env.SO_TESTS_MOUNTED_PLUGIN = JSON.stringify( expected );
	try {
		await assert.rejects(
			verifyMountedPlugin( fakeRequestUtils( [] ) ),
			/found not installed/
		);
	} finally {
		delete process.env.SO_TESTS_MOUNTED_PLUGIN;
	}
} );
