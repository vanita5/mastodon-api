import readline from 'readline'

import Mastodon from '../lib/mastodon'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

let clientId
let clientSecret

Mastodon.createOAuthApp()
    .catch(err => console.error(err))
    .then((res) => {
        console.log('Please save \'id\', \'client_id\' and \'client_secret\' in your program and use it from now on!')
        console.log(res)

        clientId = res.client_id
        clientSecret = res.client_secret

        return Mastodon.getAuthorizationUrl(clientId, clientSecret)
    })
    .then(url => {
        console.log('This is the authorization URL. Open it in your browser and authorize with your account!')
        console.log(url)
        return new Promise((resolve) => {
            rl.question('Please enter the code from the website: ', code => {
                resolve(code)
                rl.close()
            })
        })
    })
    .then(code => Mastodon.getAccessToken(clientId, clientSecret, code))
    .catch(err => console.error(err))
    .then(accessToken => {
        console.log(`This is the access token. Save it!\n${accessToken}`)
    })
