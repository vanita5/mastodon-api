'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _jsonBigint = require('json-bigint');

var _jsonBigint2 = _interopRequireDefault(_jsonBigint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Parser = function (_EventEmitter) {
    _inherits(Parser, _EventEmitter);

    function Parser() {
        _classCallCheck(this, Parser);

        var _this = _possibleConstructorReturn(this, (Parser.__proto__ || Object.getPrototypeOf(Parser)).call(this));

        _this.message = '';
        return _this;
    }

    _createClass(Parser, [{
        key: 'parse',
        value: function parse(chunk) {
            // skip heartbeats
            if (chunk === ':thump\n') {
                this.emit('heartbeat', {});
                return;
            }

            this.message += chunk;
            chunk = this.message;

            var size = chunk.length;
            var start = 0;
            var offset = 0;
            var curr = void 0;
            var next = void 0;

            while (offset < size) {
                curr = chunk[offset];
                next = chunk[offset + 1];

                if (curr === '\n' && next === '\n') {
                    var piece = chunk.slice(start, offset);

                    offset += 2;
                    start = offset;

                    /* eslint-disable no-continue */
                    if (!piece.length) continue; // empty object

                    var root = piece.split('\n');

                    // should never happen, as long as mastodon doesn't change API messages
                    if (root.length !== 2) continue;

                    // remove event and data markers
                    var event = root[0].substr(7);
                    var data = root[1].substr(6);

                    try {
                        data = _jsonBigint2.default.parse(data);
                    } catch (err) {
                        this.emit('error', new Error('Error parsing API reply: \'' + piece + '\', error message: \'' + err + '\''));
                    } finally {
                        if (data) {
                            // filter
                            this.emit('element', { event: event, data: data });
                        }
                        // eslint-disable-next-line no-unsafe-finally
                        continue;
                    }
                }
                offset++;
            }
            this.message = chunk.slice(start, size);
        }
    }]);

    return Parser;
}(_events.EventEmitter);

exports.default = Parser;