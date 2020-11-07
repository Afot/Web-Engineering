
var config = require('../config/config');


module.exports = function(app) {


    app.use(function(err, req, res, next) {
        config.logger.error('500 - EXCEPTION', {
            username: (req.session.user) ? req.session.user.username : 'AnonymousUser',
            accessed_url: req.originalUrl,
            is_ajax: req.xhr,
            stacktrace: err.stack,
        });
        res.status(500);
        var is_ajax_request = req.xhr;
        var error_data = {
            error: err,
            stacktrace: err.stack
        };
        if (req.session.error) {
            error_data.message = req.session.error;
        }
        if (!is_ajax_request) {
            res.render(config.TEMPL_500, error_data);
        } else {
            res.json(error_data);
        }
    });


    app.use(function(req, res, next) {
        config.logger.error('404 - PAGE NOT FOUND', {
            username: (req.session.user) ? req.session.user.username : 'AnonymousUser',
            accessed_url: req.originalUrl,
            referer_url: req.headers.referer
        });
        res.status(404);
        res.render(config.TEMPL_404, {
            url: req.url
        });
        return;
    });
}