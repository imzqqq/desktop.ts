import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

export const ca = [
	fs.readFileSync(path.join(__dirname, '../../test-https-server/ssl_cert.pem')),
	fs.readFileSync(path.join(__dirname, '../../test-https-server/ssl_teapot_cert.pem')),
];

export async function testRequest<C extends typeof https | typeof http>(client: C, options: C extends typeof https ? https.RequestOptions : http.RequestOptions, testOptions: { assertResult?: (result: any) => void; } = {}) {
	return new Promise<void>((resolve, reject) => {
		const req = client.request(options, res => {
			if (!res.statusCode || res.statusCode < 200 || res.statusCode > 299) {
				reject(new Error(`Error status: ${res.statusCode} ${res.statusMessage}`));
			}
			let data = '';
			res.setEncoding('utf8');
			res.on('data', chunk => {
				data += chunk;
			});
			res.on('end', () => {
				try {
					const result = JSON.parse(data);
					assert.equal(result.status, 'OK!');
					if (testOptions.assertResult) {
						testOptions.assertResult(result);
					}
					resolve();
				} catch (err: any) {
					err.message = `${err.message}: ${data}`;
					reject(err);
				}
			});
		});
		req.on('error', err => {
			reject(new Error(`Error: ${err.message}`));
		});
		req.end();
	});
}
