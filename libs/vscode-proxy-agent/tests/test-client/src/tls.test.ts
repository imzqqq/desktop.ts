import * as tls from 'tls';
import { createTlsPatch, SecureContextOptionsPatch } from '../../../src/index';
import { ca } from './utils';

describe('TLS patch', function () {
	it('should work without CA option', function (done) {
		const tlsPatched = {
			...tls,
			...createTlsPatch(tls),
		};
		const options: tls.ConnectionOptions = {
			host: 'test-https-server',
			port: 443,
			servername: 'test-https-server', // for SNI
		};
		(options as SecureContextOptionsPatch)._vscodeAdditionalCaCerts = ca.map(ca => ca.toString());
		options.secureContext = tlsPatched.createSecureContext(options); // Needed here because we don't patch tls like in VS Code.
		const socket = tlsPatched.connect(options);
		socket.on('error', done);
		socket.on('secureConnect', () => {
			const { authorized, authorizationError } = socket;
			socket.destroy();
			if (authorized) {
				done();
			} else {
				done(authorizationError);
			}
		});
	});
});
