var isodate = require("isodate"),
    crypto = require('crypto'),
    fs = require('fs-ext'),
    async = require('async'),
    solrUtils = require('../solrUtils'),

    settings = require('../settings'),
    utils = require('../utils');

var mmm = require('mmmagic'),
    mime = new mmm.Magic(mmm.MAGIC_MIME_TYPE);


var log = utils.getLogger("store.attachment");

AttachmentStore = function() {
    return {
        getPreview : function(handshake, options, callback) {
            var user = handshake.session.user.hash,
                attachment = options.attachmentId + ".attachment",
                messageId = options.messageId;

            if (!messageId || !options.attachmentId) {
                log.error("No messageId or attachmentId");
                callback("No message id or attachment id");
                return;
            }


            function readAndSend(filepath, reply) {
                log.debug("Sending " + filepath);
                if (!fs.existsSync(filepath)) {
                    callback("File " + filepath + " doesn't exist");
                    return;
                }
                fs.readFile(filepath, function (err, data) {
                    reply.thumbnail = new Buffer(data, 'binary').toString('base64');
                    callback(null, reply);
                });
            }

            
            var path = utils.attachmentPath(messageId, attachment);

            if (!fs.existsSync(path)) {
                callback("File " + path + " dosn't exist");
                return;
            }

            async.parallel({
                stats : function(callback) {
                    fs.stat(path, callback); 
                },
                mime : function(callback) {
                    mime.detectFile(path, callback);
                }
            }, function(err, results) {
                if (err) {
                    callback(err, null);
                    return;
                }

                var filetype = results.mime;
                var filesize = results.stats.size;

                var reply = {
                    id : attachment,
                    filetype : filetype,
                    filesize : filesize,
                    messageId : messageId,
                };

                utils.createThumbnail(path, filetype, function(err, thumbnail) {
                    if (err) {
                        callback(null, reply);
                        return;
                    }
                    readAndSend(thumbnail, reply);
                });
            });

        },
        getAttachment : function(handshake, options, callback) {
            var user = handshake.session.user.hash,
                attachment = options.attachmentId + ".attachment",
                messageId = options.messageId;

            if (!messageId || !options.attachmentId) {
                log.error("No messageId or attachmentId");
                callback("No message id or attachment id");
                return;
            }

        }
    }
};

module.exports = {
    AttachmentStore : AttachmentStore
}
