/**
 * Reads the WordPress version a test run asks for.
 *
 * Set `SO_TESTS_WP_VERSION` to run the Playground on a specific WordPress
 * version, such as a plugin's minimum. Leave it unset for the latest.
 *
 * @throws {Error} If the value is set and is not a version number.
 *
 * @return {string} The version, as `major.minor` or `major.minor.patch`,
 *                  or an empty string when none is asked for.
 */
const wordPressVersion = () => {
	const version = ( process.env.SO_TESTS_WP_VERSION || '' ).trim();

	if ( version === '' ) {
		return '';
	}

	if ( ! /^\d+\.\d+(\.\d+)?$/.test( version ) ) {
		throw new Error(
			`Invalid SO_TESTS_WP_VERSION: "${ version }". Use a WordPress version such as 6.6 or 6.6.2, or leave it unset for the latest.`
		);
	}

	return version;
};

module.exports = wordPressVersion;
