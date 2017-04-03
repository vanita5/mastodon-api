import Mastodon from '../lib/mastodon'

/* eslint-disable no-console */

const M = new Mastodon({
    access_token: '88005e52e4b695c2f485296243d8f356c962d5c85e70c107ebfb50266bf55293'
})

M.get('timelines/home', {}).then(resp => console.log(resp.data))
