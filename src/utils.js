const crc32 = require('crc-32');

exports.checksum = function(str) {
    return crc32.str(str.toString()).toString(16);
};

function waitfor(seconds) {
    var waitTill = new Date(new Date().getTime() + seconds * 1000);
    while (waitTill > new Date()) { }
}
exports.waitfor = waitfor;
