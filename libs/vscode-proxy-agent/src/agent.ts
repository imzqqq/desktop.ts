import http from 'http';
import https from 'https';
import net from 'net';
import once from '@tootallnate/once';
import createDebug from 'debug';
import { Readable } from 'stream';
import { format, parse } from 'url';
import { HttpProxyAgent, HttpProxyAgentOptions } from 'http-proxy-agent';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';
import {
	Agent,
	AgentCallbackReturn,
	AgentOptions,
	ClientRequest,
	RequestOptions
} from 'agent-base';

const debug = createDebug('pac-proxy-agent');

type FindProxyForURL = (req: http.ClientRequest, opts: http.RequestOptions, url: string) => Promise<string | undefined>;

/**
 * The `PacProxyAgent` class.
 *
 * A few different "protocol" modes are supported (supported protocols are
 * backed by the `get-uri` module):
 *
 *   - "pac+data", "data" - refers to an embedded "data:" URI
 *   - "pac+file", "file" - refers to a local file
 *   - "pac+ftp", "ftp" - refers to a file located on an FTP server
 *   - "pac+http", "http" - refers to an HTTP endpoint
 *   - "pac+https", "https" - refers to an HTTPS endpoint
 *
 * @api public
 */
class _PacProxyAgent extends Agent {
	resolver: FindProxyForURL;
	opts: createPacProxyAgent.PacProxyAgentOptions;
	cache?: Readable;

	constructor(resolver: FindProxyForURL, opts: createPacProxyAgent.PacProxyAgentOptions = {}) {
		super(opts);
		debug('Creating PacProxyAgent with options %o', opts);

		this.resolver = resolver;
		this.opts = { ...opts };
		this.cache = undefined;
	}

	/**
	 * Called when the node-core HTTP client library is creating a new HTTP request.
	 *
	 * @api protected
	 */
	async callback(
		req: ClientRequest,
		opts: RequestOptions
	): Promise<AgentCallbackReturn> {
		const { secureEndpoint } = opts;

		// Calculate the `url` parameter
		const defaultPort = secureEndpoint ? 443 : 80;
		let path = req.path;
		let search: string | null = null;
		const firstQuestion = path.indexOf('?');
		if (firstQuestion !== -1) {
			search = path.substring(firstQuestion);
			path = path.substring(0, firstQuestion);
		}

		const urlOpts = {
			...opts,
			protocol: secureEndpoint ? 'https:' : 'http:',
			pathname: path,
			search,

			// need to use `hostname` instead of `host` otherwise `port` is ignored
			hostname: opts.host,
			host: null,
			href: null,

			// set `port` to null when it is the protocol default port (80 / 443)
			port: defaultPort === opts.port ? null : opts.port
		};
		const url = format(urlOpts);

		debug('url: %o', url);
		let result = await this.resolver(req, opts, url);

		// Default to "DIRECT" if a falsey value was returned (or nothing)
		if (!result) {
			result = 'DIRECT';
		}

		const proxies = String(result)
			.trim()
			.split(/\s*;\s*/g)
			.filter(Boolean);

		if (this.opts.fallbackToDirect && !proxies.includes('DIRECT')) {
			proxies.push('DIRECT');
		}

		for (const proxy of proxies) {
			let agent: http.Agent | null = null;
			let socket: net.Socket | null = null;
			const [type, target] = proxy.split(/\s+/);
			debug('Attempting to use proxy: %o', proxy);

			if (type === 'DIRECT') {
				// Needed for SNI.
				const originalAgent = this.opts.originalAgent;
				const defaultAgent = secureEndpoint ? https.globalAgent : http.globalAgent;
				agent = originalAgent === false ? new (defaultAgent as any).constructor() : (originalAgent || defaultAgent)
			} else if (type === 'SOCKS' || type === 'SOCKS5') {
				// Use a SOCKSv5h proxy
				agent = new SocksProxyAgent(`socks://${target}`);
			} else if (type === 'SOCKS4') {
				// Use a SOCKSv4a proxy
				agent = new SocksProxyAgent(`socks4a://${target}`);
			} else if (
				type === 'PROXY' ||
				type === 'HTTP' ||
				type === 'HTTPS'
			) {
				// Use an HTTP or HTTPS proxy
				// http://dev.chromium.org/developers/design-documents/secure-web-proxy
				const proxyURL = `${
					type === 'HTTPS' ? 'https' : 'http'
				}://${target}`;
				const proxyOpts = { ...this.opts, ...parse(proxyURL) };
				if (secureEndpoint) {
					agent = new HttpsProxyAgent(proxyOpts);
				} else {
					agent = new HttpProxyAgent(proxyOpts);
				}
			}

			try {
				if (socket) {
					// "DIRECT" connection, wait for connection confirmation
					await once(socket, 'connect');
					req.emit('proxy', { proxy, socket });
					return socket;
				}
				if (agent) {
					let s: AgentCallbackReturn;
					if (agent instanceof Agent) {
						s = await agent.callback(req, opts);
					} else {
						s = agent;
					}
					req.emit('proxy', { proxy, socket: s });
					return s;
				}
				throw new Error(`Could not determine proxy type for: ${proxy}`);
			} catch (err) {
				debug('Got error for proxy %o: %o', proxy, err);
				req.emit('proxy', { proxy, error: err });
			}
		}

		throw new Error(
			`Failed to establish a socket connection to proxies: ${JSON.stringify(
				proxies
			)}`
		);
	}
}

function createPacProxyAgent(
	resolver: FindProxyForURL,
	opts?: createPacProxyAgent.PacProxyAgentOptions
): _PacProxyAgent {
	if (!opts) {
		opts = {};
	}

	if (typeof resolver !== 'function') {
		throw new TypeError('a resolve function must be specified!');
	}

	return new _PacProxyAgent(resolver, opts);
}

namespace createPacProxyAgent {
	export interface PacProxyAgentOptions
		extends AgentOptions,
			HttpProxyAgentOptions,
			HttpsProxyAgentOptions,
			SocksProxyAgentOptions {
		fallbackToDirect?: boolean;
		originalAgent?: false | http.Agent;
	}

	export type PacProxyAgent = _PacProxyAgent;
	export const PacProxyAgent = _PacProxyAgent;

	createPacProxyAgent.prototype = _PacProxyAgent.prototype;
}

export = createPacProxyAgent;