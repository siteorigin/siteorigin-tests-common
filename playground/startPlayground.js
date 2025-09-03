const { parseOptionsAndRunCLI } = require( '@wp-playground/cli' );
const { getBuildDirectory } = require( '../utilities/builds' );

/**
 * Generates CLI arguments to mount the build directory if required.
 *
 * @param {boolean} mountBuild Whether to include build arguments.
 * @return {string[]} CLI arguments for mounting the build directory.
 */
const maybeAddBuildArgs = ( mountBuild ) => {
	if ( mountBuild ) {
		const buildDirectory = getBuildDirectory();
		const mountDir = buildDirectory.path.replace( /\\/g, '/' );
		const vfs = `/wordpress/wp-content/plugins/${ buildDirectory.name }`;

		return [ '--mountDirBeforeInstall', mountDir, vfs ];
	}

	return [];
};

/**
 * Resolves the absolute path to a blueprint JSON file.
 *
 * Validates the blueprint name to ensure it only contains alphanumeric
 * characters, hyphens, and underscores, preventing directory traversal attacks.
 *
 * @param {string} blueprint The name of the blueprint file (without extension).
 * @throws {Error} If the blueprint name contains invalid characters.
 *
 * @return {string} The absolute path to the blueprint JSON file.
 */
const getBlueprintPath = ( blueprint ) => {
	if ( ! /^[a-zA-Z0-9_-]+$/.test( blueprint ) ) {
		throw new Error(
			`Invalid blueprint name: "${ blueprint }". Only alphanumeric, hyphen, and underscore are allowed.`
		);
	}

	const blueprintDir = path.resolve( __dirname, 'blueprints' );
	return path.join( blueprintDir, `${ blueprint }.json` );
};

/**
 * Starts the WordPress Playground server.
 *
 * This function initializes and starts a WordPress Playground instance
 * using the specified blueprint and optional build arguments. It
 * dynamically constructs CLI arguments to configure the server and
 * ensures the process is properly cleaned up after execution.
 *
 * @async
 * @param {boolean} [mountBuild=false] Whether to include build arguments
 *                                     for mounting the build directory.
 * @param {number} [port=1129] The port number on which the Playground
 *                             server will run.
 * @param {string} [blueprint='core'] The name of the blueprint to use
 *                                   (without the `.json` extension).
 *
 * @throws {Error} If the blueprint name is invalid or the server fails to start.
 * @return {Promise<void>} Resolves when the server starts successfully.
 */
const startPlayground = async (
	mountBuild = false,
	port = 1129,
	blueprint = 'core'
) => {
	const cliArgs = [
		'server',
		`--blueprint=${ getBlueprintPath( blueprint ) }`,
		'--port',
		port,
		...maybeAddBuildArgs( mountBuild ),
	];

	const originalArgvLength = process.argv.length;
	process.argv.push( ...cliArgs );

	try {
		await parseOptionsAndRunCLI();
	} finally {
		process.argv.splice( originalArgvLength );
	}
};

module.exports = startPlayground;
