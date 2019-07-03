'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var STATUS_CODES_TO_ABORT_ON = exports.STATUS_CODES_TO_ABORT_ON = [400, 401, 403, 404, 406, 410, 422];
var REQUIRED_KEYS_FOR_AUTH = exports.REQUIRED_KEYS_FOR_AUTH = ['access_token'];

var DEFAULT_REST_BASE = exports.DEFAULT_REST_BASE = 'https://mastodon.social';
var DEFAULT_REST_API_POSTFIX = exports.DEFAULT_REST_API_POSTFIX = '/api/v1/';
var DEFAULT_REST_ROOT = exports.DEFAULT_REST_ROOT = DEFAULT_REST_BASE + DEFAULT_REST_API_POSTFIX;

var DEFAULT_OAUTH_APPS_ENDPOINT = exports.DEFAULT_OAUTH_APPS_ENDPOINT = DEFAULT_REST_ROOT + 'apps';