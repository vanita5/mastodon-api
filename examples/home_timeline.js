import Mastodon from '../lib/mastodon'

const M = new Mastodon({
    access_token: '...'
})

M.get('timelines/home', {}).then(resp => console.log(resp.data))
