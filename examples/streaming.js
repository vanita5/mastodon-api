import Mastodon from '../lib/mastodon'

const M = new Mastodon({
    access_token: '...'
})

const stream = M.stream('streaming/user')

stream.on('message', (msg) => {
    console.log(msg)
})

stream.on('error', (err) => {
    console.log(err)
})

stream.on('heartbeat', (msg) => {
    console.log('thump.')
})
