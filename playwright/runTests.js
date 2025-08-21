/**
 * Runs Playwright end-to-end tests.
 *
 * - Loads environment variables from so-tests.env.
 * - Ensures required environment variables are present.
 * - Switches to the highest installed Node version using nvm.
 * - Runs Playwright tests via npm script.
 * - Restores the Node version to 10.18.1 after tests.
 *
 * @module runTests
 */

const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve( process.cwd(), 'tests', 'so-tests.env' );
dotenv.config( { path: envPath } );

const isWindows = process.platform === 'win32';

// Ensure system32 is in PATH for Windows compatibility.
if ( isWindows && ! process.env.PATH.includes( 'C:\\WINDOWS\\system32' ) ) {
	process.env.PATH = `${ process.env.PATH };C:\\WINDOWS\\system32`;
}

// Ensure required environment variables are present.
if (
	! process.env.WP_BASE_URL ||
	! process.env.WP_USERNAME ||
	! process.env.WP_PASSWORD
) {
	throw new Error( 'Missing required environment variables in so-tests.env' );
}

// Store currently active node version.
const currentNodeVersion = execSync( 'node -v' ).toString().trim();

// Find the highest installed Node version using nvm.
const highestNodeVersionInstalled = execSync( 'nvm ls' ).toString().split( '\n' )
	.map( line => line.match( /\b\d+\.\d+\.\d+\b/ ) )
	.filter( Boolean )
	.map( match => match[ 0 ] )
	.sort( ( a, b ) => {
		const [ majorA, minorA, patchA ] = a.split( '.' ).map( Number );
		const [ majorB, minorB, patchB ] = b.split( '.' ).map( Number );
		if ( majorA !== majorB ) return majorB - majorA;
		if ( minorA !== minorB ) return minorB - minorA;
		return patchB - patchA;
	} )[ 0 ];

let shellCmd;
// Switch to the highest Node version if not already active.
if ( currentNodeVersion !== highestNodeVersionInstalled ) {
	shellCmd = `nvm use ${ highestNodeVersionInstalled } && `;
	console.log( `Switching to Node ${ highestNodeVersionInstalled }` );
}

shellCmd += `npx npm run test:e2e`;

execSync( shellCmd, { stdio: 'inherit', shell: isWindows ? 'cmd.exe' : '/bin/sh' } );

// Restore build script Node version if needed.
if ( currentNodeVersion !== '10.18.1' ) {
	execSync( 'nvm use 10.18.1', { stdio: 'inherit', shell: isWindows ? 'cmd.exe' : '/bin/sh' } );
}
