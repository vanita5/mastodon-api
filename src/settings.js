const STATUS_CODES_TO_ABORT_ON = [400, 401, 403, 404, 406, 410, 422]
const DEFAULT_REST_ROOT = 'https://mastodon.social/api/v1/'
const REQUIRED_KEYS_FOR_AUTH = ['access_token']

class Settings {

    static get STATUS_CODES_TO_ABORT_ON() {
        return STATUS_CODES_TO_ABORT_ON
    }

    static get DEFAULT_REST_ROOT() {
        return DEFAULT_REST_ROOT
    }

    static get REQUIRED_KEYS_FOR_AUTH() {
        return REQUIRED_KEYS_FOR_AUTH
    }
}

export default Settings
