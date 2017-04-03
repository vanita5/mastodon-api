import readline from 'readline'

import Mastodon from '../lib/mastodon'

/* eslint-disable no-console */

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

Mastodon.createOAuthApp()
    .catch(err => console.error(err))
    .then((res) => {
        console.log('Please save \'id\', \'client_id\' and \'client_secret\' in your program and use it from now on!')
        console.log(res)
        return Mastodon.getAuthorizationUrl(res.client_id, res.client_secret)
    })
    .then((data) => {
        console.log('This is the authorization URL. Open it in your browser and authorize with your account!')
        console.log(data.url)
        return new Promise((resolve) => {
            rl.question('Please enter the code from the website: ', (code) => {
                data.code = code
                resolve(data)
                rl.close()
            })
        })
    })
    .then(data => Mastodon.getAccessToken(data.clientId, data.clientSecret, data.code))
    .catch(err => console.error(err))
    .then((accessToken) => {
        console.log(`This is the access token. Save it!\n${accessToken}`)
    })
