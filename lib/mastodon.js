'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _oauth = require('oauth');

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _jsonBigint = require('json-bigint');

var _jsonBigint2 = _interopRequireDefault(_jsonBigint);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

var _streamingApiConnection = require('./streaming-api-connection');

var _streamingApiConnection2 = _interopRequireDefault(_streamingApiConnection);

var _settings = require('./settings');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Mastodon = function () {
    function Mastodon(config) {
        _classCallCheck(this, Mastodon);

        this.apiUrl = config.api_url || _settings.DEFAULT_REST_ROOT;

        Mastodon._validateConfigOrThrow(config);

        this.config = config;
        this._mastodon_time_minus_local_time_ms = 0;
    }

    _createClass(Mastodon, [{
        key: 'get',
        value: function get(path, params, callback) {
            return this.request('GET', path, params, callback);
        }
    }, {
        key: 'patch',
        value: function patch(path, params, callback) {
            return this.request('PATCH', path, params, callback);
        }
    }, {
        key: 'post',
        value: function post(path, params, callback) {
            return this.request('POST', path, params, callback);
        }
    }, {
        key: 'put',
        value: function put(path, params, callback) {
            return this.request('PUT', path, params, callback);
        }
    }, {
        key: 'delete',
        value: function _delete(path, params, callback) {
            return this.request('DELETE', path, params, callback);
        }
    }, {
        key: 'request',
        value: function request(method, path, params, callback) {
            var self = this;
            (0, _assert2.default)(method === 'GET' || method === 'PATCH' || method === 'POST' || method === 'PUT' || method === 'DELETE');
            // if no `params` is specified but a callback is, use default params
            if (typeof params === 'function') {
                callback = params;
                params = {};
            }

            return new Promise(function (resolve, reject) {
                var _returnErrorToUser = function _returnErrorToUser(err) {
                    if (callback && typeof callback === 'function') {
                        callback(err, null, null);
                    }
                    reject(err);
                };

                self._buildRequestOptions(method, path, params, function (err, requestOptions) {
                    if (err) {
                        _returnErrorToUser(err);
                        return;
                    }

                    var mastodonOptions = params && params.masto_options || {};

                    process.nextTick(function () {
                        // ensure all HTTP i/o occurs after the user
                        // has a chance to bind their event handlers
                        Mastodon._doRESTAPIRequest(requestOptions, mastodonOptions, method, function (reqerr, parsedBody, response) {
                            self._updateClockOffsetFromResponse(response);

                            if (self.config.trusted_cert_fingerprints) {
                                if (!response.socket.authorized) {
                                    // The peer certificate was not signed
                                    // by one of the authorized CA's.
                                    var authErrMsg = response.socket.authorizationError.toString();
                                    var merr = _helpers2.default.makeMastodonError('The peer certificate was not signed; ' + authErrMsg);
                                    _returnErrorToUser(merr);
                                    return;
                                }
                                var fingerprint = response.socket.getPeerCertificate().fingerprint;
                                var trustedFingerprints = self.config.trusted_cert_fingerprints;
                                if (!trustedFingerprints.includes(fingerprint)) {
                                    var errMsg = _util2.default.format('Certificate untrusted. Trusted fingerprints are: %s. Got fingerprint: %s.', trustedFingerprints.join(','), fingerprint);
                                    var _merr = new Error(errMsg);
                                    _returnErrorToUser(_merr);
                                    return;
                                }
                            }

                            if (callback && typeof callback === 'function') {
                                callback(reqerr, parsedBody, response);
                            }

                            resolve({ data: parsedBody, resp: response });
                        });
                    });
                });
            });
        }
    }, {
        key: '_updateClockOffsetFromResponse',
        value: function _updateClockOffsetFromResponse(response) {
            if (response && response.headers && response.headers.date) {
                var date = new Date(response.headers.date);
                if (date.toString() === 'Invalid Date') return;
                this._mastodon_time_minus_local_time_ms = date.getTime() - Date.now();
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

    }, {
        key: '_buildRequestOptions',
        value: function _buildRequestOptions(method, path, params, callback) {
            var finalParams = params || {};
            delete finalParams.mastodon_options;

            // the options object passed to `request` used to perform the HTTP request
            var requestOptions = {
                headers: {
                    Accept: '*/*',
                    'User-Agent': 'node-mastodon-client',
                    Authorization: 'Bearer ' + this.config.access_token
                },
                gzip: true,
                encoding: null
            };

            if (typeof this.config.timeout_ms !== 'undefined') {
                requestOptions.timeout_ms = this.config.timeout_ms;
            }

            try {
                // finalize the `path` value by building it using user-supplied params
                path = _helpers2.default.moveParamsIntoPath(finalParams, path);
            } catch (e) {
                callback(e, null, null);
                return;
            }

            if (path.match(/^https?:\/\//i)) {
                // This is a full url request
                requestOptions.url = path;
            } else {
                // This is a REST API request.
                requestOptions.url = '' + this.apiUrl + path;
            }

            if (finalParams.file) {
                // If we're sending a file
                requestOptions.headers['Content-type'] = 'multipart/form-data';
                requestOptions.formData = finalParams;
            } else if (Object.keys(finalParams).length > 0) {
                // Non-file-upload params should be url-encoded
                requestOptions.url += Mastodon.formEncodeParams(finalParams);
            }

            callback(null, requestOptions);
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

    }, {
        key: 'stream',
        value: function stream(path, params) {
            var mastodonOptions = params && params.mastodon_options || {};

            var streamingConnection = new _streamingApiConnection2.default();
            this._buildRequestOptions('GET', path, params, function (err, requestOptions) {
                if (err) {
                    // surface this on the streamingConnection instance
                    // (where a user may register their error handler)
                    streamingConnection.emit('error', err);
                    return;
                }
                // set the properties required to start the connection
                streamingConnection.requestOptions = requestOptions;
                streamingConnection.mastodonOptions = mastodonOptions;

                process.nextTick(function () {
                    streamingConnection.start();
                });
            });
            return streamingConnection;
        }
    }, {
        key: 'auth',
        set: function set(auth) {
            var self = this;
            _settings.REQUIRED_KEYS_FOR_AUTH.forEach(function (k) {
                if (auth[k]) {
                    self.config[k] = auth[k];
                }
            });
        },
        get: function get() {
            return this.config;
        }
    }], [{
        key: '_doRESTAPIRequest',
        value: function _doRESTAPIRequest(requestOptions, mastodonOptions, method, callback) {
            var requestMethod = _request2.default[method.toLowerCase()];
            var request = requestMethod(requestOptions);

            var body = '';
            var response = void 0;

            request.on('response', function (res) {
                response = res;
                // read data from `request` object which contains the decompressed HTTP response body,
                // `response` is the unmodified http.IncomingMessage object
                // which may contain compressed data
                request.on('data', function (chunk) {
                    body += chunk.toString('utf8');
                });
                // we're done reading the response
                request.on('end', function () {
                    if (body !== '') {
                        try {
                            body = _jsonBigint2.default.parse(body);
                        } catch (jsonDecodeError) {
                            // there was no transport-level error,
                            // but a JSON object could not be decoded from the request body
                            // surface this to the caller
                            var err = _helpers2.default.makeMastodonError('JSON decode error: Mastodon HTTP response body was not valid JSON');
                            err.statusCode = response ? response.statusCode : null;
                            err.allErrors.concat({ error: jsonDecodeError.toString() });
                            callback(err, body, response);
                            return;
                        }
                    }

                    if ((typeof body === 'undefined' ? 'undefined' : _typeof(body)) === 'object' && (body.error || body.errors)) {
                        // we got a Mastodon API-level error response
                        // place the errors in the HTTP response body
                        // into the Error object and pass control to caller
                        var _err = _helpers2.default.makeMastodonError('Mastodon API Error');
                        _err.statusCode = response ? response.statusCode : null;
                        _err = _helpers2.default.attachBodyInfoToError(_err, body);
                        callback(_err, body, response);
                        return;
                    }

                    // success case - no errors in HTTP response body
                    callback(null, body, response);
                });

                request.on('error', function (err) {
                    // transport-level error occurred - likely a socket error
                    if (mastodonOptions.retry && _settings.STATUS_CODES_TO_ABORT_ON.includes(err.statusCode)) {
                        // retry the request since retries were specified
                        // and we got a status code we should retry on
                        // FIXME
                        // this.request(method, path, params, callback);
                    } else {
                        // pass the transport-level error to the caller
                        err.statusCode = null;
                        err.code = null;
                        err.allErrors = [];
                        err = _helpers2.default.attachBodyInfoToError(err, body);
                        callback(err, body, response);
                    }
                });
            });
        }
    }, {
        key: 'formEncodeParams',
        value: function formEncodeParams(params, noQuestionMark) {
            var encoded = '';
            Object.keys(params).forEach(function (key) {
                var value = params[key];
                if (encoded === '' && !noQuestionMark) {
                    encoded = '?';
                } else {
                    encoded += '&';
                }

                if (Array.isArray(value)) {
                    value.forEach(function (v) {
                        encoded += encodeURIComponent(key) + '[]=' + encodeURIComponent(v) + '&';
                    });
                } else {
                    encoded += encodeURIComponent(key) + '=' + encodeURIComponent(value);
                }
            });
            return encoded;
        }
    }, {
        key: '_validateConfigOrThrow',
        value: function _validateConfigOrThrow(config) {
            if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) !== 'object') {
                throw new TypeError('config must be object, got ' + (typeof config === 'undefined' ? 'undefined' : _typeof(config)) + '.');
            }

            if (typeof config.timeout_ms !== 'undefined' && isNaN(Number(config.timeout_ms))) {
                throw new TypeError('config parameter \'timeout_ms\' must be a Number, got ' + config.timeout_ms + '.');
            }

            _settings.REQUIRED_KEYS_FOR_AUTH.forEach(function (reqKey) {
                if (!config[reqKey]) {
                    throw new Error('Mastodon config must include \'' + reqKey + '\' when using \'user_auth\'');
                }
            });
        }
    }, {
        key: 'createOAuthApp',
        value: function createOAuthApp() {
            var url = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _settings.DEFAULT_OAUTH_APPS_ENDPOINT;
            var clientName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'mastodon-node';
            var scopes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'read write follow';
            var redirectUri = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'urn:ietf:wg:oauth:2.0:oob';
            var webSite = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;

            return new Promise(function (resolve, reject) {
                _request2.default.post({
                    url: url,
                    form: {
                        client_name: clientName,
                        website: webSite,
                        redirect_uris: redirectUri,
                        scopes: scopes
                    }
                }, function (err, res, body) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    try {
                        body = _jsonBigint2.default.parse(body);
                    } catch (e) {
                        reject(new Error('Error parsing body ' + body));
                    }
                    resolve(body);
                });
            });
        }
    }, {
        key: 'getAuthorizationUrl',
        value: function getAuthorizationUrl(clientId, clientSecret) {
            var baseUrl = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _settings.DEFAULT_REST_BASE;
            var scope = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'read write follow';
            var redirectUri = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'urn:ietf:wg:oauth:2.0:oob';

            return new Promise(function (resolve) {
                var oauth = new _oauth.OAuth2(clientId, clientSecret, baseUrl, null, '/oauth/token');
                var url = oauth.getAuthorizeUrl({
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    client_id: clientId,
                    scope: scope
                });
                resolve(url);
            });
        }
    }, {
        key: 'getAccessToken',
        value: function getAccessToken(clientId, clientSecret, authorizationCode) {
            var baseUrl = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : _settings.DEFAULT_REST_BASE;
            var redirectUri = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'urn:ietf:wg:oauth:2.0:oob';

            return new Promise(function (resolve, reject) {
                var oauth = new _oauth.OAuth2(clientId, clientSecret, baseUrl, null, '/oauth/token');
                oauth.getOAuthAccessToken(authorizationCode, {
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri
                }, function (err, accessToken /* , refreshToken, res */) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(accessToken);
                });
            });
        }
    }]);

    return Mastodon;
}();

module.exports = Mastodon;