'use strict';

var http   = require( 'http' );
var events = require( 'events' );
var util   = require( 'util' );

var internals = {
	'initialize' : function ( error, statusCode, message ) {
		this.assert( !isNaN( parseFloat( statusCode ) ) && isFinite( statusCode ) && statusCode >= 400, 'First argument must be a number (400+):', statusCode );

		error.isRestError = true;

		if ( !error.hasOwnProperty( 'data' ) ) {
			error.data = null;
		}

		error.output = {
			'statusCode' : statusCode,
			'payload'    : { },
			'headers'    : { }
		};

		error.reformat = this.reformat;
		error.reformat();


		if ( !message && !error.message ) {
			message = error.output.payload.error;
		}

		if ( message ) {
			error.message = ( message + ( error.message ? ': ' + error.message : '' ) );
		}

		return error;
	},

	'assert' : function ( condition ) {
		if ( condition ) {
			return;
		}

		var msgs = [ ];
		for ( var i = 1, il = arguments.length; i < il; ++i ) {
			if ( arguments[ i ] !== '' ) {
				msgs.push( arguments[ i ] );  // Avoids Array.slice arguments leak, allowing for V8 optimizations
			}
		}

		msgs = msgs.map( function ( msg ) {
			return typeof msg === 'string' ? msg : msg instanceof Error ? msg.message : exports.stringify( msg );
		} );

		throw new Error( msgs.join( ' ' ) || 'Unknown error' );
	},

	'reformat' : function () {
		this.output.payload.statusCode = this.output.statusCode;
		this.output.payload.error      = http.STATUS_CODES[ this.output.statusCode ] || 'Unknown';

		if ( this.output.statusCode === 500 ) {
			this.output.payload.message = 'An internal server error occurred';  // Hide actual error from user
		} else if ( this.message ) {
			this.output.payload.message = this.message;
		}
	},

	// Escape attribute value for use in HTTP header
	'escapeHeaderAttribute' : function ( attribute ) {
		// Allowed value characters: !#$%&'()*+,-./:;<=>?@[]^_`{|}~ and space, a-z, A-Z, 0-9, \, "
		this.assert( /^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~\"\\]*$/.test( attribute ), 'Bad attribute value (' + attribute + ')' );

		return attribute.replace( /\\/g, '\\\\' ).replace( /\"/g, '\\"' );  // Escape quotes and slash
	}
};

var RestErrors = exports.RestErrors = function () {
	events.EventEmitter.call( this );
};
util.inherits( RestErrors, events.EventEmitter );

RestErrors.prototype.wrap = function ( error, statusCode, message ) {
	internals.assert( error instanceof Error, 'Cannot wrap non-Error object' );

	// emit error event
	this.emit( 'errorOccur', error );

	return error.isRestError ? error : internals.initialize( error, statusCode || 500, message );
};

RestErrors.prototype.create = function ( statusCode, message, data ) {
	var error  = new Error( message ? message : undefined );
	error.data = data || null;
	internals.initialize( error, statusCode );

	// emit error event
	this.emit( 'errorOccur', error );

	return error;
};

// 4xx Client Errors
RestErrors.prototype.badRequest = function ( message, data ) {
	return this.create( 400, message, data );
}

RestErrors.prototype.unauthorized = function ( message, scheme, attributes ) {  // Or function ( message, wwwAuthenticate[ ] )
	var err = this.create( 401, message );

	if ( !scheme ) {
		return err;
	}

	var wwwAuthenticate = '';

	var i  = 0;
	var il = 0;

	if ( typeof scheme === 'string' ) {
		// function ( message, scheme, attributes )
		wwwAuthenticate = scheme;
		if ( attributes ) {
			var names = Object.keys( attributes );
			for ( i = 0, il = names.length; i < il; ++i ) {
				if ( i ) {
					wwwAuthenticate += ',';
				}

				var value = attributes[ names[ i ] ];
				if ( value === null || value === undefined ) {  // Value can be zero
					value = '';
				}
				wwwAuthenticate += ' ' + names[ i ] + '="' + internals.escapeHeaderAttribute( value.toString() ) + '"';
			}
		}

		if ( message ) {
			if ( attributes ) {
				wwwAuthenticate += ',';
			}
			wwwAuthenticate += ' error="' + internals.escapeHeaderAttribute( message ) + '"';
			}
		else {
			err.isMissing = true;
		}
	} else {
		// function ( message, wwwAuthenticate[ ] )
		var wwwArray = scheme;

		for ( i = 0, il = wwwArray.length; i < il; ++i ) {
			if ( i ) {
				wwwAuthenticate += ', ';
			}

			wwwAuthenticate += wwwArray[ i ];
		}
	}

	err.output.headers[ 'WWW-Authenticate' ] = wwwAuthenticate;

	return err;
};

RestErrors.prototype.forbidden = function ( message, data ) {
	return this.create( 403, message, data );
};

RestErrors.prototype.notFound = function ( message, data ) {
	return this.create( 404, message, data );
};

RestErrors.prototype.methodNotAllowed = function ( message, data ) {
	return this.create( 405, message, data );
};

RestErrors.prototype.notAcceptable = function ( message, data ) {
	return this.create( 406, message, data );
};

RestErrors.prototype.proxyAuthRequired = function ( message, data ) {
	return this.create( 407, message, data );
};

RestErrors.prototype.clientTimeout = function ( message, data ) {
	return this.create( 408, message, data );
};

RestErrors.prototype.conflict = function ( message, data ) {
	return this.create( 409, message, data );
};

RestErrors.prototype.resourceGone = function ( message, data ) {
	return this.create (410, message, data );
};

RestErrors.prototype.lengthRequired = function ( message, data ) {
	return this.create( 411, message, data );
};

RestErrors.prototype.preconditionFailed = function ( message, data ) {
	return this.create( 412, message, data );
};

RestErrors.prototype.entityTooLarge = function ( message, data ) {
	return this.create(413, message, data);
};

RestErrors.prototype.uriTooLong = function ( message, data ) {
	return this.create(414, message, data);
};

RestErrors.prototype.unsupportedMediaType = function ( message, data ) {
	return this.create( 415, message, data );
};

RestErrors.prototype.rangeNotSatisfiable = function ( message, data ) {
	return this.create( 416, message, data );
};

RestErrors.prototype.expectationFailed = function ( message, data ) {
	return this.create( 417, message, data);
};

RestErrors.prototype.badData = function ( message, data ) {
	return this.create( 422, message, data );
};

RestErrors.prototype.tooManyRequests = function ( message, data ) {
	return this.create( 429, message, data );
};

// 5xx Server Errors
RestErrors.prototype.internal = function ( message, data, statusCode ) {
	var error = ( data instanceof Error ? this.wrap( data, statusCode, message ) : this.create( statusCode || 500, message ) );

	if ( data instanceof Error === false ) {
		error.data = data;
	}

	return error;
};

RestErrors.prototype.badImplementation = function ( message, data ) {
	var err = this.internal( message, data, 500 );
	err.isDeveloperError = true;

	return err;
};

RestErrors.prototype.notImplemented = function ( message, data ) {
	return this.internal( message, data, 501 );
};

RestErrors.prototype.badGateway = function ( message, data ) {
	return this.internal( message, data, 502 );
};

RestErrors.prototype.serverTimeout = function ( message, data ) {
	return this.internal( message, data, 503 );
};

RestErrors.prototype.gatewayTimeout = function ( message, data ) {
	return this.internal( message, data, 504 );
};
