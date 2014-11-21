var RestErrors = require( '../' );
var events     = require( 'events' );

// Load Assertion Library
require( 'should' );

describe( 'RestErrors', function () {

	var restErrors = new RestErrors();

	it ( 'inherits event emitter', function () {
		( restErrors instanceof events.EventEmitter ).should.be.true;
		RestErrors.super_.should.eql( events.EventEmitter );
	} );

} );

describe( 'wrap()', function () {

	var restErrors;

	beforeEach(function () {
		restErrors = new RestErrors();
	} );

	it( 'returns the same object when already in rest error', function () {
		var error   = restErrors.badRequest();
		var wrapped = restErrors.wrap( error );

		wrapped.should.eql( error );
	} );

	it( 'returns an error with info if constructed using another error', function () {
		var error   = new Error( 'error message' );
		error.xyz   = 123;
		var wrapped = restErrors.wrap( error );

		wrapped.xyz.should.eql( 123 );
		wrapped.message.should.eql( 'error message' );
		wrapped.output.should.eql( {
			'statusCode' : 500,
			'payload' : {
				'statusCode' : 500,
				'error' : 'Internal Server Error',
				'message' : 'An internal server error occurred'
			},
			'headers' : { }
		} );
		( wrapped.data === null ).should.be.true;
	} );

	it( 'does not override data when constructed using another error', function () {
		var error   = new Error( 'error message' );
		error.data  = { 'data' : 'data' };
		var wrapped = restErrors.wrap( error )

		wrapped.data.should.eql( error.data );
	} );

	it( 'sets new message when none exists', function () {
		var error   = new Error();
		var wrapped = restErrors.wrap( error, 400, 'something bad' );

		wrapped.message.should.eql( 'something bad' );
	} );

	it( 'throws when statusCode is not a number', function () {
		restErrors.create.bind( null, 'x' ).should.throw( 'First argument must be a number (400+): x' );
	} );

	it( 'sets error code to unknown', function () {
		var error = restErrors.create( 999 );

		error.output.payload.error.should.eql( 'Unknown' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.wrap( new Error(), 400, 'something bad' );
	} );

} );

describe( 'create()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'does not set null message', function () {
		var error = restErrors.unauthorized( null );

		error.output.payload.message.should.be.empty;
	} );

	it( 'sets message and data', function () {
		var error = restErrors.badRequest( 'Missing data', { 'type' : 'user' } );

		error.data.type.should.eql( 'user' );
		error.output.payload.message.should.eql( 'Missing data' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.create( 400, 'something bad' );
	} );

} );

describe( 'isRestError', function () {

	it( 'returns true for RestErrors object', function () {
		var error = new RestErrors().badRequest();

		error.isRestError.should.be.true;
	} );

	it( 'returns false for Error object', function () {
		var error = new Error();

		( error.isRestError === undefined ).should.be.true;
	} );

} );

describe( 'badRequest()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 400 error statusCode', function () {
		restErrors.badRequest().output.statusCode.should.eql( 400 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.badRequest( 'bad request' ).message.should.eql( 'bad request' );
	} );

	it( 'sets the message to HTTP status if none is provided', function () {
		restErrors.badRequest().message.should.eql( 'Bad Request' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.badRequest();
	} );

} );

describe( 'unauthorized()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 401 error statusCode', function () {
		var error = restErrors.unauthorized();

		error.output.statusCode.should.eql( 401 );
		error.output.headers.should.eql( { } );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.unauthorized( 'unauthorized' ).message.should.eql( 'unauthorized' );
	} );

	it( 'returns a WWW-Authenticate header when passed a scheme', function () {
		var error = restErrors.unauthorized( 'unauthorized', 'Test' );

		error.output.statusCode.should.eql( 401 );
		error.output.headers[ 'WWW-Authenticate' ].should.eql( 'Test error="unauthorized"' );
	} );

	it( 'returns a WWW-Authenticate header set to the schema array value', function () {
		var error = restErrors.unauthorized( null, [ 'Test', 'one', 'two' ] );

		error.output.statusCode.should.eql( 401 );
		error.output.headers[ 'WWW-Authenticate' ].should.eql( 'Test, one, two' );
	} );

	it( 'returns a WWW-Authenticate header when passed a scheme and attributes', function () {
		var error =  restErrors.unauthorized( 'unauthorized', 'Test', { 'a' : 1, 'b' : 'something', 'c' : null, 'd' : 0 } );

		error.output.statusCode.should.eql( 401 );
		error.output.headers[ 'WWW-Authenticate' ].should.eql( 'Test a="1", b="something", c="", d="0", error="unauthorized"' );
	} );

	it( 'returns a WWW-Authenticate header when passed attributes, missing error', function () {
		var error = restErrors.unauthorized( null, 'Test', { 'a' : 1, 'b' : 'something', 'c' : null, 'd' : 0 } );
		error.output.statusCode.should.eql( 401 );
		error.output.headers[ 'WWW-Authenticate' ].should.eql( 'Test a="1", b="something", c="", d="0"' );
		error.isMissing.should.be.true;
	} );

	it( 'sets the isMissing flag when error message is empty', function () {
		var error = restErrors.unauthorized( '', 'Basic' );

		error.isMissing.should.be.true;
	} );

	it( 'does not sets the isMissing flag when error message is not empty', function () {
		var error = restErrors.unauthorized( 'message', 'Basic' );

		(error.isMissing === undefined ).should.be.true;
	} );

	it( 'sets a WWW-Authenticate when passed as an array', function () {
		var error = restErrors.unauthorized( 'message', [ 'Basic', 'Example e="1"', 'Another x="3", y="4"' ] );

		error.output.headers[ 'WWW-Authenticate' ].should.eql( 'Basic, Example e="1", Another x="3", y="4"' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.unauthorized();
	} );

} );

describe( 'forbidden()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 403 error statusCode', function () {
		restErrors.forbidden().output.statusCode.should.eql( 403 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.forbidden( 'forbidden' ).message.should.eql( 'forbidden' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.forbidden();
	} );

} );

describe( 'notFound()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 404 error statusCode', function () {
		restErrors.notFound().output.statusCode.should.eql( 404 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.notFound( 'not found' ).message.should.eql( 'not found' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.notFound();
	} );

} );

describe( 'methodNotAllowed()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 405 error statusCode', function () {
		restErrors.methodNotAllowed().output.statusCode.should.eql( 405 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.methodNotAllowed( 'method not allowed' ).message.should.eql( 'method not allowed' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.methodNotAllowed();
	} );

} );

describe( 'notAcceptable()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 406 error statusCode', function () {
		restErrors.notAcceptable().output.statusCode.should.eql( 406 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.notAcceptable( 'not acceptable' ).message.should.eql( 'not acceptable' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.notAcceptable();
	} );

} );

describe( 'proxyAuthRequired()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 407 error statusCode', function () {
		restErrors.proxyAuthRequired().output.statusCode.should.eql( 407 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.proxyAuthRequired( 'proxy auth required' ).message.should.eql( 'proxy auth required' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.proxyAuthRequired();
	} );

} );

describe( 'clientTimeout()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 408 error statusCode', function () {
		restErrors.clientTimeout().output.statusCode.should.eql( 408 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.clientTimeout( 'client timeout' ).message.should.eql( 'client timeout' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.clientTimeout();
	} );

} );

describe( 'conflict()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 409 error statusCode', function () {
		restErrors.conflict().output.statusCode.should.eql( 409 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.conflict( 'conflict' ).message.should.eql( 'conflict' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.conflict();
	} );

} );

describe( 'resourceGone()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 410 error statusCode', function () {
		restErrors.resourceGone().output.statusCode.should.eql( 410 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.resourceGone( 'resource gone' ).message.should.eql( 'resource gone' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.resourceGone();
	} );

} );

describe( 'lengthRequired()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 411 error statusCode', function () {
		restErrors.lengthRequired().output.statusCode.should.eql( 411 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.lengthRequired( 'length required' ).message.should.eql( 'length required' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.lengthRequired();
	} );

} );

describe( 'preconditionFailed()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 412 error statusCode', function () {
		restErrors.preconditionFailed().output.statusCode.should.eql( 412 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.preconditionFailed( 'precondition failed' ).message.should.eql( 'precondition failed' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.preconditionFailed();
	} );

} );

describe( 'entityTooLarge()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 413 error statusCode', function () {
		restErrors.entityTooLarge().output.statusCode.should.eql( 413 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.entityTooLarge( 'entity too large' ).message.should.eql( 'entity too large' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.entityTooLarge();
	} );

} );

describe( 'uriTooLong()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 414 error statusCode', function () {
		restErrors.uriTooLong().output.statusCode.should.eql( 414 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.uriTooLong( 'uri too long' ).message.should.eql( 'uri too long' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.uriTooLong();
	} );

} );

describe( 'unsupportedMediaType()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 415 error statusCode', function () {
		restErrors.unsupportedMediaType().output.statusCode.should.eql( 415 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.unsupportedMediaType( 'unsupported media type' ).message.should.eql( 'unsupported media type' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.unsupportedMediaType();
	} );

} );

describe( 'rangeNotSatisfiable()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 416 error statusCode', function () {
		restErrors.rangeNotSatisfiable().output.statusCode.should.eql( 416 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.rangeNotSatisfiable( 'range not satisfiable' ).message.should.eql( 'range not satisfiable' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.rangeNotSatisfiable();
	} );

} );

describe( 'expectationFailed()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 417 error statusCode', function () {
		restErrors.expectationFailed().output.statusCode.should.eql( 417 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.expectationFailed( 'expectation failed' ).message.should.eql( 'expectation failed' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.expectationFailed();
	} );

} );

describe( 'badData()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 422 error statusCode', function () {
		restErrors.badData().output.statusCode.should.eql( 422 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.badData( 'bad data' ).message.should.eql( 'bad data' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.badData();
	} );

} );

describe( 'tooManyRequests()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 429 error statusCode', function () {
		restErrors.tooManyRequests().output.statusCode.should.eql( 429 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.tooManyRequests( 'too many requests' ).message.should.eql( 'too many requests' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.tooManyRequests();
	} );

} );

describe( 'internal()', function () {

	var restErrors;
	var internalError;

	beforeEach( function () {
		restErrors = new RestErrors();
		error     = restErrors.internal( 'internal error', { 'my' : 'data' } );
	} );

	it( 'returns a 500 error statusCode', function () {
		error.output.statusCode.should.eql( 500 );
	} );

	it( 'sets the message with the passed in message', function () {
		error.message.should.eql( 'internal error' );
		error.output.payload.message.should.eql( 'An internal server error occurred' );
	} );

	it( 'passes data on the callback if its passed in', function () {
		error.data.my.should.eql( 'data' );
	} );

	it( 'returns an error with composite message', function () {
		try {
			JSON.parse( '{' );
		} catch ( error ) {
			var error = restErrors.internal( 'Something bad', error );
			error.message.should.eql( 'Something bad: Unexpected end of input' );
		}
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.internal();
	} );

} );

describe( 'badImplementation()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 500 error statusCode', function () {
		var error = restErrors.badImplementation();

		error.output.statusCode.should.eql( 500 );
		error.isDeveloperError.should.eql( true );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.badImplementation( 'bad implementation' ).message.should.eql( 'bad implementation' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.badImplementation();
	} );

} );

describe( 'notImplemented()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 501 error statusCode', function () {
		restErrors.notImplemented().output.statusCode.should.eql( 501 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.notImplemented( 'not implemented' ).message.should.eql( 'not implemented' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.notImplemented();
	} );

} );

describe( 'badGateway()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 502 error statusCode', function () {
		restErrors.badGateway().output.statusCode.should.eql( 502 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.badGateway( 'bad gateway' ).message.should.eql( 'bad gateway' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.badGateway();
	} );

} );

describe( 'serverTimeout()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 503 error statusCode', function () {
		restErrors.serverTimeout().output.statusCode.should.eql( 503 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.serverTimeout( 'server timeout' ).message.should.eql( 'server timeout' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.serverTimeout();
	} );

} );

describe( 'gatewayTimeout()', function () {

	var restErrors;

	beforeEach( function () {
		restErrors = new RestErrors();
	} );

	it( 'returns a 504 error statusCode', function () {
		restErrors.gatewayTimeout().output.statusCode.should.eql( 504 );
	} );

	it( 'sets the message with the passed in message', function () {
		restErrors.gatewayTimeout( 'gateway timeout' ).message.should.eql( 'gateway timeout' );
	} );

	it( 'emits errorOccur event', function ( done ) {
		restErrors.on( 'errorOccur', function () {
			done();
		} );

		restErrors.gatewayTimeout();
	} );

} );
