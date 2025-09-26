const { spawn } = require( 'child_process' );

/**
 * Executes a shell command asynchronously and streams stdout/stderr directly.
 *
 * @param {string} command - The command to execute.
 * @param {Array<string>} args - Arguments to pass to the command.
 * @param {Object} options - Options to pass to the spawn function.
 * @param {Function} [dataCallback] - Optional callback to handle stdout/stderr data.
 * @param {Function} [closeCallback] - Optional callback to handle the close event.
 * @param {Function} [errorCallback] - Optional callback to handle the error event.
 *
 * @return {Promise<void>} Resolves when the command completes successfully.
 */
const execAsync = (
	command,
	args = [],
	options = {},
	dataCallback = null,
	closeCallback = null,
	errorCallback = null
) => {
	const isWindows = process.platform === 'win32';

	return new Promise( ( resolve, reject ) => {
		const stdio = dataCallback ? [ 'pipe', 'pipe', 'pipe' ] : 'inherit';
		options.stdio = stdio;

		const child = spawn( command, args, {
			shell: isWindows ? 'cmd.exe' : '/bin/bash',
			...options,
			stdio,
		} );

		if ( dataCallback ) {
			if ( child.stdout ) {
				child.stdout.on( 'data', ( data ) => {
					dataCallback( data.toString(), 'stdout' );
				} );
			}

			if ( child.stderr ) {
				child.stderr.on( 'data', ( data ) => {
					dataCallback( data.toString(), 'stderr' );
				} );
			}
		}

		child.on( 'close', ( code ) => {
			if ( closeCallback ) {
				closeCallback( code );
			}
			if ( code === 0 ) {
				resolve();
			} else {
				reject( new Error( `Command failed with exit code ${ code }` ) );
			}
		} );

		child.on( 'error', ( error ) => {
			if ( errorCallback ) {
				errorCallback( error );
			}
			reject( error );
		} );
	} );
};

module.exports = execAsync;
