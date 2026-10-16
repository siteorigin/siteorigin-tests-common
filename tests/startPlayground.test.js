const { test, beforeEach, afterEach } = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );

// Replace the Playground CLI with a stub that records the arguments it gets.
const cliCalls = [];
const cliPath = require.resolve( '@wp-playground/cli', {
	paths: [ path.resolve( __dirname, '../playground' ) ],
} );
require.cache[ cliPath ] = {
	id: cliPath,
	filename: cliPath,
	loaded: true,
	exports: {
		parseOptionsAndRunCLI: async () => {
			cliCalls.push( [ ...process.argv ] );
		},
	},
};

const startPlayground = require( '../playground/startPlayground' );

const originalCwd = process.cwd();

const makeDir = ( files ) => {
	const dir = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'so-tests-' ) ), 'feature-x' );
	for ( const [ file, contents ] of Object.entries( files ) ) {
		fs.mkdirSync( path.dirname( path.join( dir, file ) ), { recursive: true } );
		fs.writeFileSync( path.join( dir, file ), contents );
	}
	process.chdir( dir );
	return process.cwd();
};

const header = ( version ) => `<?php\n/*\nPlugin Name: SiteOrigin Widgets Bundle\nVersion: ${ version }\n*/\n`;

const mountArgs = ( argv ) => argv.slice( argv.indexOf( '--mountDirBeforeInstall' ), argv.indexOf( '--mountDirBeforeInstall' ) + 3 );

beforeEach( () => {
	cliCalls.length = 0;
	delete process.env.SO_TESTS_MOUNTED_PLUGIN;
} );

afterEach( () => {
	process.chdir( originalCwd );
	delete process.env.SO_TESTS_MOUNTED_PLUGIN;
} );

test( 'a worktree mounts its source at the plugin slug', async () => {
	const dir = makeDir( { 'so-widgets-bundle.php': header( 'dev' ) } );

	await startPlayground( false );

	assert.equal( cliCalls.length, 1 );
	assert.deepEqual( mountArgs( cliCalls[ 0 ] ), [
		'--mountDirBeforeInstall',
		dir,
		'/wordpress/wp-content/plugins/so-widgets-bundle',
	] );
	assert.deepEqual( JSON.parse( process.env.SO_TESTS_MOUNTED_PLUGIN ), {
		plugin: 'so-widgets-bundle/so-widgets-bundle',
		version: 'dev',
	} );
} );

test( 'a build mounts the dist folder at the plugin slug', async () => {
	// The folder name differs from the slug, so only the main file can give the slug.
	const dir = makeDir( { 'dist/release-build/so-widgets-bundle.php': header( '2.0.0' ) } );

	await startPlayground( true );

	assert.deepEqual( mountArgs( cliCalls[ 0 ] ), [
		'--mountDirBeforeInstall',
		path.join( dir, 'dist', 'release-build' ),
		'/wordpress/wp-content/plugins/so-widgets-bundle',
	] );
	assert.deepEqual( JSON.parse( process.env.SO_TESTS_MOUNTED_PLUGIN ), {
		plugin: 'so-widgets-bundle/so-widgets-bundle',
		version: '2.0.0',
	} );
} );

test( 'an external site clears a mount recorded earlier', async () => {
	makeDir( {
		'so-widgets-bundle.php': header( 'dev' ),
		'tests/so-tests.env': 'WP_BASE_URL=https://tests.test/\n',
	} );
	process.env.SO_TESTS_MOUNTED_PLUGIN = JSON.stringify( { plugin: 'old/old', version: '1' } );

	assert.equal( await startPlayground( false ), false );
	assert.equal( cliCalls.length, 0 );
	assert.equal( process.env.SO_TESTS_MOUNTED_PLUGIN, undefined );
} );

test( 'a mount without a plugin file clears a mount recorded earlier', async () => {
	makeDir( { 'index.php': '<?php\n' } );
	process.env.SO_TESTS_MOUNTED_PLUGIN = JSON.stringify( { plugin: 'old/old', version: '1' } );

	await assert.rejects( startPlayground( false ), /found: none/ );
	assert.equal( cliCalls.length, 0 );
	assert.equal( process.env.SO_TESTS_MOUNTED_PLUGIN, undefined );
} );
