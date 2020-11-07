
var async = require('async'),
    date_format = require('../controllers/node_modules/date-format-lite'),
    config = require('../config/config'),
    models = require('../models/models'),
    misc = require('../utils/misc'),
    quiz = require('../utils/quiz');

function getUsernameFromId(user_id, fn) {
    models.User.findOne({
        _id: user_id
    }, function(err, user) {
        return fn(null, user.username);
    });
}


function getUserIdFromName(username, fn) {
    models.User.findOne({
        username: username
    }, function(err, user) {
        return fn(null, user._id);
    });
}


function getDailyQuestionsCount(fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var query = {
        date: {
            $gte: start_day
        }
    };
    models.Question.count(query, function(err, count) {
        return fn(null, count);
    });
}

function getLastQuizDate(username, fn) {
    getUserIdFromName(username, function(err, user_id) {
        var to_find = {
            user_id: user_id
        };
        var query = models.QuizHistory.find(to_find);
        query.sort({
            date: -1
        });
        query.select('date');
        query.limit(1);
	query.lean();
        query.exec(function(err, results) {
            return fn(null, results);
        });
    });
}


function getTotalUserCount(fn) {
    models.User.where({
        'admin': false
    }).count(function(err, count) {
        return fn(null, count);
    });
}

function getTotalQuestionCount(fn) {
    models.Question.count(function(err, count) {
        return fn(null, count);
    });
}


function getDailyAttendees(fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var to_find = {
        date: {
            $gte: start_day
        }
    };
    var query = models.QuizHistory.count(to_find).distinct('user_id');
    query.populate('user_id', null, {
        admin: {
            $ne: true
        }
    });
    query.lean();
    query.exec(function(err, results) {
        return fn(null, results);
    });
};



function getDailyAverageScore(fn) {
    var user_points = 0,
        today = new Date().setHours(0, 0, 0, 0);
    getDailyQuestionsCount(function(err, count) {
        getDailyAttendees(function(err, results) {
            async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, today, function(err, results) {
                    user_points += results.total_points;
                    return callback();
                });
            }, function() {
                var avg_score = user_points / results.length;
                avg_score = isNaN(avg_score) ? 0 : avg_score;
                return fn(null, avg_score);
            });
        });
    });
};


function getDailyPerfectScoresCount(fn) {
    var result_count = 0,
        today = new Date().setHours(0, 0, 0, 0);;
    getDailyAttendees(function(err, results) {
        async.eachSeries(results, function(item, callback) {
            quiz.getResults(item, today, function(err, results) {
                if (results['total_points'] == results['total_questions']) {
                    result_count++;
                }
                return callback();
            });
        }, function() {
            return fn(null, result_count);
        });
    });
}


function getDailyQuickestQuiz(fn) {
    var final_result = 0,
        today = new Date().setHours(0, 0, 0, 0);
    getDailyAttendees(function(err, results) {
        async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, today, function(err, results) {
                    if (results['total_points'] == results['total_questions']) {
                        async.eachSeries(results, function(time_item, callback) {
                            final_result += time_item['response_time'];
                            callback();
                        });
                    }
                    return callback();
                });
            },
            function() {
                return fn(null, final_result);
            });
    });
}



function getTopRanks(time_period, rank_limit, fn) {
    var start_day = new Date(),
        userscore_array = [];
    switch (time_period) {
        case 'weekly':
            misc.getMonday(function(err, result) {
                start_day = result;
            });
            break;
        case 'monthly':
            start_day = new Date(start_day.getFullYear(), start_day.getMonth(), 1);
            break;
        case 'alltime':
            start_day = null;
            break;
        default:
            start_day = null;
            break;
    }
    if (start_day) {
        start_day.setHours(0, 0, 0, 0);
    }
    var query = (start_day) ? {
        date: {
            $gte: start_day
        }
    } : {};
    models.QuizHistory.find(query).distinct('user_id', function(err, results) {
        async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, start_day, function(err, results) {
                    if (results != null) {
                        getUsernameFromId(item, function(err, username) {
                            userscore_array.push([results['total_points'], username, results['avg_response_time']]);
                            return callback();
                        });
                    } else {
                        return callback();
                    }
                });
            },
            function() {
                rank_limit = rank_limit || 50;
                userscore_array.sort(misc.rankByScoreAndResTime);
                return fn(null, userscore_array.slice(0, rank_limit));
            });
    });
}
module.exports = {
    getUserIdFromName: getUserIdFromName,
    getTopRanks: getTopRanks,
    getTotalUserCount: getTotalUserCount,
    getTotalQuestionCount: getTotalQuestionCount,
}
