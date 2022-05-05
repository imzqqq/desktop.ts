import * as https from 'https';
import createPacProxyAgent from '../../../src/agent';
import { testRequest, ca } from './utils';

describe('Proxied client', function () {
	it('should use HTTP proxy for HTTPS connection', function () {
		return testRequest(https, {
			hostname: 'test-https-server',
			path: '/test-path',
			agent: createPacProxyAgent(async () => 'PROXY test-http-proxy:3128'),
			ca,
		});
	});
});
