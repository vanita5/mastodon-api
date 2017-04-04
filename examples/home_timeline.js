import Mastodon from '../lib/mastodon'

/* eslint-disable no-console */

const M = new Mastodon({
    access_token: '...'
})

M.get('timelines/home', {}).then(resp => console.log(resp.data))
