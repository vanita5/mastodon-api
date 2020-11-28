import assert from 'assert'
import util from 'util'
import { OAuth2 } from 'oauth'
import Request from 'request'

import Helpers from './helpers'
import StreamingAPIConnection from './streaming-api-connection'

import {
    STATUS_CODES_TO_ABORT_ON,
    DEFAULT_REST_ROOT,
    DEFAULT_REST_BASE,
    REQUIRED_KEYS_FOR_AUTH,
    DEFAULT_OAUTH_APPS_ENDPOINT
} from './settings'

class Mastodon {
    constructor(config) {
        this.apiUrl = config.api_url || DEFAULT_REST_ROOT

        Mastodon._validateConfigOrThrow(config)

        this.config = config
        this._mastodon_time_minus_local_time_ms = 0
    }

    get(path, params, callback) {
        return this.request('GET', path, params, callback)
    }

    patch(path, params, callback) {
        return this.request('PATCH', path, params, callback)
    }

    post(path, params, callback) {
        return this.request('POST', path, params, callback)
    }

    put(path, params, callback) {
        return this.request('PUT', path, params, callback)
    }

    delete(path, params, callback) {
        return this.request('DELETE', path, params, callback)
    }

    request(method, path, params, callback) {
        const self = this
        assert(method === 'GET' || method === 'PATCH' || method === 'POST' || method === 'PUT' || method === 'DELETE')
        // if no `params` is specified but a callback is, use default params
        if (typeof params === 'function') {
            callback = params
            params = {}
        }

        return new Promise((resolve, reject) => {
            const _returnErrorToUser = (err) => {
                if (callback && typeof callback === 'function') {
                    callback(err, null, null)
                }
                reject(err)
            }

            self._buildRequestOptions(method, path, params, (err, requestOptions) => {
                if (err) {
                    _returnErrorToUser(err)
                    return
                }

                const mastodonOptions = (params && params.masto_options) || {}

                process.nextTick(() => {
                    // ensure all HTTP i/o occurs after the user
                    // has a chance to bind their event handlers
                    Mastodon._doRESTAPIRequest(requestOptions, mastodonOptions, method,
                        (reqerr, parsedBody, response) => {
                            self._updateClockOffsetFromResponse(response)

                            if (self.config.trusted_cert_fingerprints) {
                                if (!response.socket.authorized) {
                                    // The peer certificate was not signed
                                    // by one of the authorized CA's.
                                    const authErrMsg = response.socket.authorizationError.toString()
                                    const merr = Helpers.makeMastodonError(`The peer certificate was not signed; ${authErrMsg}`)
                                    _returnErrorToUser(merr)
                                    return
                                }
                                const { fingerprint } = response.socket.getPeerCertificate()
                                const trustedFingerprints = self.config.trusted_cert_fingerprints
                                if (!trustedFingerprints.includes(fingerprint)) {
                                    const errMsg = util.format('Certificate untrusted. Trusted fingerprints are: %s. Got fingerprint: %s.',
                                        trustedFingerprints.join(','), fingerprint)
                                    const merr = new Error(errMsg)
                                    _returnErrorToUser(merr)
                                    return
                                }
                            }

                            if (callback && typeof callback === 'function') {
                                callback(reqerr, parsedBody, response)
                            }

                            resolve({ data: parsedBody, resp: response })
                        })
                })
            })
        })
    }

    _updateClockOffsetFromResponse(response) {
        if (response && response.headers && response.headers.date) {
            const date = new Date(response.headers.date)
            if (date.toString() === 'Invalid Date') return
            this._mastodon_time_minus_local_time_ms = date.getTime() - Date.now()
        }
    }

    /**
     * Builds and returns an options object ready to pass to `request()`
     * @param  {String}   method      "GET", "POST", or "DELETE"
     * @param  {String}   path        REST API resource uri (eg. "statuses/destroy/:id")
     * @param  {Object}   params      user's params object
     * @param  {Function} callback
     * @returns {Undefined}
     *
     * Calls `callback` with Error, Object
     * where Object is an options object ready to pass to `request()`.
     *
     * Returns error raised (if any) by `helpers.moveParamsIntoPath()`
     */
    _buildRequestOptions(method, path, params, callback) {
        const finalParams = params || {}
        delete finalParams.mastodon_options

        // the options object passed to `request` used to perform the HTTP request
        const requestOptions = {
            headers: {
                Accept: '*/*',
                'User-Agent': 'node-mastodon-client',
                Authorization: `Bearer ${this.config.access_token}`
            },
            gzip: true,
            encoding: null
        }

        if (typeof this.config.timeout_ms !== 'undefined') {
            requestOptions.timeout_ms = this.config.timeout_ms
        }

        try {
            // finalize the `path` value by building it using user-supplied params
            path = Helpers.moveParamsIntoPath(finalParams, path)
        } catch (e) {
            callback(e, null, null)
            return
        }

        if (path.match(/^https?:\/\//i)) {
            // This is a full url request
            requestOptions.url = path
        } else {
            // This is a REST API request.
            requestOptions.url = `${this.apiUrl}${path}`
        }

        if (finalParams.file) {
            // If we're sending a file
            requestOptions.headers['Content-type'] = 'multipart/form-data'
            requestOptions.formData = finalParams
        } else if (Object.keys(finalParams).length > 0) {
            // Non-file-upload params should be url-encoded
            requestOptions.url += Mastodon.formEncodeParams(finalParams)
        }

        callback(null, requestOptions)
    }

    /**
     * Make HTTP request to Mastodon REST API.
     *
     * @param {Object} requestOptions
     * @param {Object} mastodonOptions
     * @param {String} method           "GET", "POST", or "DELETE"
     * @param {Function} callback
     * @private
     */
    static _doRESTAPIRequest(requestOptions, mastodonOptions, method, callback) {
        const requestMethod = Request[method.toLowerCase()]
        const request = requestMethod(requestOptions)

        let body = ''
        let response

        request.on('response', (res) => {
            response = res
            // read data from `request` object which contains the decompressed HTTP response body,
            // `response` is the unmodified http.IncomingMessage object
            // which may contain compressed data
            request.on('data', (chunk) => {
                body += chunk.toString('utf8')
            })
            // we're done reading the response
            request.on('end', () => {
                if (body !== '') {
                    try {
                        body = JSON.parse(body)
                    } catch (jsonDecodeError) {
                        // there was no transport-level error,
                        // but a JSON object could not be decoded from the request body
                        // surface this to the caller
                        const err = Helpers.makeMastodonError('JSON decode error: Mastodon HTTP response body was not valid JSON')
                        err.statusCode = response ? response.statusCode : null
                        err.allErrors.concat({ error: jsonDecodeError.toString() })
                        callback(err, body, response)
                        return
                    }
                }

                if (typeof body === 'object' && (body.error || body.errors)) {
                    // we got a Mastodon API-level error response
                    // place the errors in the HTTP response body
                    // into the Error object and pass control to caller
                    let err = Helpers.makeMastodonError('Mastodon API Error')
                    err.statusCode = response ? response.statusCode : null
                    err = Helpers.attachBodyInfoToError(err, body)
                    callback(err, body, response)
                    return
                }

                // success case - no errors in HTTP response body
                callback(null, body, response)
            })
        })

        request.on('error', (err) => {
            // transport-level error occurred - likely a socket error
            if (mastodonOptions.retry
                && STATUS_CODES_TO_ABORT_ON.includes(err.statusCode)) {
                // retry the request since retries were specified
                // and we got a status code we should retry on
                // FIXME
                // this.request(method, path, params, callback);
            } else {
                // pass the transport-level error to the caller
                err.statusCode = null
                err.code = null
                err.allErrors = []
                err = Helpers.attachBodyInfoToError(err, body)
                callback(err, body, response)
            }
        })
    }

    static formEncodeParams(params, noQuestionMark) {
        let encoded = ''
        Object.keys(params).forEach((key) => {
            const value = params[key]
            if (encoded === '' && !noQuestionMark) {
                encoded = '?'
            } else {
                encoded += '&'
            }

            if (Array.isArray(value)) {
                value.forEach((v) => {
                    encoded += `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}&`
                })
            } else {
                encoded += `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            }
        })
        return encoded
    }

    set auth(auth) {
        const self = this
        REQUIRED_KEYS_FOR_AUTH.forEach((k) => {
            if (auth[k]) {
                self.config[k] = auth[k]
            }
        })
    }

    get auth() {
        return this.config
    }

    static _validateConfigOrThrow(config) {
        if (typeof config !== 'object') {
            throw new TypeError(`config must be object, got ${typeof config}.`)
        }

        if (typeof config.timeout_ms !== 'undefined'
                && Number.isNaN(Number(config.timeout_ms))) {
            throw new TypeError(`config parameter 'timeout_ms' must be a Number, got ${config.timeout_ms}.`)
        }

        REQUIRED_KEYS_FOR_AUTH.forEach((reqKey) => {
            if (!config[reqKey]) {
                throw new Error(`Mastodon config must include '${reqKey}' when using 'user_auth'`)
            }
        })
    }

    static createOAuthApp(url = DEFAULT_OAUTH_APPS_ENDPOINT,
        clientName = 'mastodon-node',
        scopes = 'read write follow',
        redirectUri = 'urn:ietf:wg:oauth:2.0:oob',
        webSite = null) {
        return new Promise((resolve, reject) => {
            Request.post({
                url,
                form: {
                    client_name: clientName,
                    website: webSite,
                    redirect_uris: redirectUri,
                    scopes
                }
            }, (err, res, body) => {
                if (err) {
                    reject(err)
                    return
                }
                try {
                    body = JSON.parse(body)
                } catch (e) {
                    reject(new Error(`Error parsing body ${body}`))
                }
                resolve(body)
            })
        })
    }

    static getAuthorizationUrl(clientId, clientSecret,
        baseUrl = DEFAULT_REST_BASE,
        scope = 'read write follow',
        redirectUri = 'urn:ietf:wg:oauth:2.0:oob') {
        return new Promise((resolve) => {
            const oauth = new OAuth2(clientId, clientSecret, baseUrl, null, '/oauth/token')
            const url = oauth.getAuthorizeUrl({
                redirect_uri: redirectUri,
                response_type: 'code',
                client_id: clientId,
                scope
            })
            resolve(url)
        })
    }

    static getAccessToken(clientId, clientSecret, authorizationCode,
        baseUrl = DEFAULT_REST_BASE,
        redirectUri = 'urn:ietf:wg:oauth:2.0:oob') {
        return new Promise((resolve, reject) => {
            const oauth = new OAuth2(clientId, clientSecret, baseUrl, null, '/oauth/token')
            oauth.getOAuthAccessToken(authorizationCode, {
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            }, (err, accessToken /* , refreshToken, res */) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(accessToken)
            })
        })
    }

    stream(path, params) {
        const mastodonOptions = (params && params.mastodon_options) || {}

        const streamingConnection = new StreamingAPIConnection()
        this._buildRequestOptions('GET', path, params, (err, requestOptions) => {
            if (err) {
                // surface this on the streamingConnection instance
                // (where a user may register their error handler)
                streamingConnection.emit('error', err)
                return
            }
            // set the properties required to start the connection
            streamingConnection.requestOptions = requestOptions
            streamingConnection.mastodonOptions = mastodonOptions

            process.nextTick(() => {
                streamingConnection.start()
            })
        })
        return streamingConnection
    }
}

module.exports = Mastodon
