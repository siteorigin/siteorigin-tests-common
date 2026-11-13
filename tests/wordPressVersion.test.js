const { test, beforeEach, afterEach } = require( 'node:test' );
const assert = require( 'node:assert/strict' );

const wordPressVersion = require( '../playground/wordPressVersion' );

beforeEach( () => {
	delete process.env.SO_TESTS_WP_VERSION;
} );

afterEach( () => {
	delete process.env.SO_TESTS_WP_VERSION;
} );

test( 'no version is asked for when the variable is unset or empty', () => {
	assert.equal( wordPressVersion(), '' );

	process.env.SO_TESTS_WP_VERSION = '';
	assert.equal( wordPressVersion(), '' );

	process.env.SO_TESTS_WP_VERSION = '  ';
	assert.equal( wordPressVersion(), '' );
} );

test( 'a major.minor or major.minor.patch version is returned', () => {
	process.env.SO_TESTS_WP_VERSION = '6.6';
	assert.equal( wordPressVersion(), '6.6' );

	process.env.SO_TESTS_WP_VERSION = '6.6.11';
	assert.equal( wordPressVersion(), '6.6.11' );

	process.env.SO_TESTS_WP_VERSION = ' 7.1 ';
	assert.equal( wordPressVersion(), '7.1' );
} );

test( 'anything that is not a version throws and names the value', () => {
	for ( const value of [ 'latest', 'abc', '6', '6.6; rm -rf', '6.6 --php=7.4', '6.6.1.2', 'v6.6' ] ) {
		process.env.SO_TESTS_WP_VERSION = value;
		assert.throws( wordPressVersion, ( error ) => error.message.includes( value ), value );
	}
} );
