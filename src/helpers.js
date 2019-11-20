/* eslint-disable no-param-reassign */

class Helpers {
    /**
     * For each `/:param` fragment in path, move the value in params
     * at that key to path. If the key is not found in params, throw.
     * Modifies both params and path values.
     *
     * @param {Object} params
     * @param {String} path
     * @return {XML|string|void|*}
     */
    static moveParamsIntoPath(params, path) {
        const rgxParam = /\/:(\w+)/g

        path = path.replace(rgxParam, (hit) => {
            const paramName = hit.slice(2)
            const suppliedVal = params[paramName]

            if (!suppliedVal) {
                throw new Error(`Mastodon: Params object is missing a required parameter for this request: ${paramName}`)
            }

            delete params[paramName]
            return `/${suppliedVal}`
        })
        return path
    }

    /**
     * When Mastodon returns a response that looks like an error response,
     * use this function to attach the error info in the response body to `err`.
     *
     * @param {Error} err
     * @param {Object} body
     */
    static attachBodyInfoToError(err, body) {
        err.mastodonReply = body

        if (!body) return err

        if (body.error) {
            // the body itself is an error object
            err.message = body.error
            err.allErrors = err.allErrors.concat([body])
        } else if (body.errors && body.errors.length) {
            // body contains multiple error objects
            err.message = body.errors[0].message
            err.code = body.errors[0].code
            err.allErrors = err.allErrors.concat(body.errors)
        }
        return err
    }

    /**
     * Mastodon error object
     *
     * @param {String} message
     * @return {Error}
     */
    static makeMastodonError(message) {
        const err = Error()
        if (message) err.message = message
        err.code = null
        err.allErrors = []
        err.mastodonReply = null
        return err
    }
}

export default Helpers
