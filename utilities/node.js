const { execSync } = require( 'child_process' );

/**
 * Gets the current Node.js version.
 *
 * @return {Promise<string>} The current Node.js version.
 */
const getCurrentNodeVersion = async () => execSync( 'node -v' ).toString().trim();

/**
 * Finds the highest installed Node.js version using nvm.
 *
 * @return {string} The highest installed Node.js version.
 */
const getHighestNodeVersionInstalled = () => {
	return execSync( 'nvm ls' ).toString().split( '\n' )
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
};

/**
 * Changes the Node.js version using nvm.
 *
 * @param {string} version - The Node.js version to switch to.
 */
const changeNodeVersion = async ( version ) => {
	const isWindows = process.platform === 'win32';

	execSync(
		`nvm use ${ version }`, {
			stdio: 'inherit',
			shell: isWindows ? 'cmd.exe' : '/bin/sh'
		}
	);
};

/**
 * Switches to the highest installed Node.js version if not already active.
 */
const maybeSwitchToHighestNodeVersion = async () => {
	const highestNodeVersionInstalled = getHighestNodeVersionInstalled();
	const currentNodeVersion = await getCurrentNodeVersion();

	if ( currentNodeVersion !== highestNodeVersionInstalled ) {
		await changeNodeVersion( highestNodeVersionInstalled );
	}
};

/**
 * Switches to the Node.js version required for the build process.
 */
const maybeSwitchToBuildVersion = async () => {
	const buildNodeVersion = '10.18.1';
	const currentNodeVersion = await getCurrentNodeVersion();

	if ( currentNodeVersion !== buildNodeVersion ) {
		await changeNodeVersion( buildNodeVersion );
	}
};

/**
 * Reverts to the previous Node.js version if it has changed.
 *
 * @param {string} previousVersion - The previous Node.js version.
 */
const maybeRevertNodeVersionChange = async ( previousVersion ) => {
	const currentNodeVersion = await getCurrentNodeVersion();
	if ( currentNodeVersion !== previousVersion ) {
		await changeNodeVersion( previousVersion );
	}
};

module.exports = {
	changeNodeVersion,
	getCurrentNodeVersion,
	maybeRevertNodeVersionChange,
	maybeSwitchToBuildVersion,
	maybeSwitchToHighestNodeVersion,
};
