export const STATUS_CODES_TO_ABORT_ON = [400, 401, 403, 404, 406, 410, 422]
export const REQUIRED_KEYS_FOR_AUTH = ['access_token']

export const DEFAULT_REST_BASE = 'https://mastodon.social'
export const DEFAULT_REST_API_POSTFIX = '/api/v1/'
export const DEFAULT_REST_ROOT = DEFAULT_REST_BASE + DEFAULT_REST_API_POSTFIX

export const DEFAULT_OAUTH_APPS_ENDPOINT = `${DEFAULT_REST_ROOT}apps`
