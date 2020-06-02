const moment = require('moment'),
    chatMessageModel = mongoose.model('rocketchat_message', new mongoose.Schema({}), 'rocketchat_message'),
    roomModel = mongoose.model('rocketchat_room', new mongoose.Schema({}), 'rocketchat_room'),
    usersModel = mongoose.model('users', new mongoose.Schema({}), 'users'),
    _ = require('lodash');

const getMessagesWithTarget = async (text, date) => {

    console.log(text);
    const nextDay = moment(date).add(1, 'day').format('YYYY-MM-DD');

    let messagesArray = [],
        rids = [],
        findObject = {
            msg: {'$regex': text}, ts: {
                $gte: new Date(date + ' 00:00:00'),
                $lt: new Date(nextDay + ' 00:00:00')
            }
        };
    console.log(findObject);

    let messages = await chatMessageModel.find(findObject).lean();

    if (!messages || messages.length === 0) {
        return {message: "No data found for " + date, data: messagesArray, html: ''};
    }

    rids = _.map(messages, m => {
        return m.rid;
    });


    let getRoomData = await roomModel.aggregate([{
        $match: {
            _id: {$in: rids}
        }
    }]);

    messages.forEach(message => {

        let roomData = _.find(getRoomData, (r) => {
            return r._id == message.rid;
        });

        if (roomData.usersCount === 2) {
            messagesArray.push({
                id: messagesArray.length + 1,
                from: message.u.name,
                to: '',
                receiver: roomData.usernames[0] == message.u.username ? roomData.usernames[1] : roomData.usernames[0],
                date: message.ts,
                message: message.msg
            });
        }
    });

    let userNamesToFind = _.map(messagesArray, 'receiver');

    let userNameFind = await usersModel.find({username: {$in: userNamesToFind}}, {name: 1, username: 1}).lean();

    messagesArray.forEach(finalMessage => {
        let nameFind = _.find(userNameFind, (find) => {
            return find.username == finalMessage.receiver;
        });

        finalMessage.to = nameFind.name;
    });

    let transform = {
        "tag": "tr", "children": [
            {"tag": "td", "html": "${id}"},
            {"tag": "td", "html": "${from}"},
            {"tag": "td", "html": "${to}"},
            {"tag": "td", "html": "${message}"},
        ]
    };

    return {
        msg: text,
        date: date,
        data: messagesArray
    }
}

const getMessagesWithTargetFromTo = async (text, dateStart, dateEnd, userName1, userName2) => {

    const endDay = moment(dateEnd).add(1, 'day').startOf('day').format('YYYY-MM-DD'),
        startDay = moment(dateStart).startOf('day').format('YYYY-MM-DD');

    let user1 = await usersModel.find({username: _.trim(userName1)}, {_id: 1}),
        user2 = await usersModel.find({username: _.trim(userName2)}, {_id: 1});

    if (!user1 && !user2) {
        return {message: "user name not found", data: messagesArray, html: ''};
    }

    let messagesArray = [],
        rids = [],
        findObject = {
            $or: [{rid: `${user1._id}${user2._id}`}, {rid: `${user2._id}${user1._id}`}],
            msg: {'$regex': text}, ts: {
                $gte: new Date(startDay + ' 00:00:00'),
                $lt: new Date(endDay + ' 00:00:00')
            }
        };
    console.log(findObject);

    let messages = await chatMessageModel.find(findObject).lean();

    if (!messages || messages.length === 0) {
        return {message: "No data found between " + startDay + " and " + endDay, data: messagesArray, html: ''};
    }

    rids = _.map(messages, m => {
        return m.rid;
    });

    let getRoomData = await roomModel.aggregate([{
        $match: {
            _id: {$in: rids}
        }
    }]);

    messages.forEach(message => {

        let roomData = _.find(getRoomData, (r) => {
            return r._id == message.rid;
        });

        if (roomData.usersCount === 2) {
            messagesArray.push({
                id: messagesArray.length + 1,
                from: message.u.name,
                to: '',
                receiver: roomData.usernames[0] == message.u.username ? roomData.usernames[1] : roomData.usernames[0],
                date: message.ts,
                message: message.msg
            });
        }
    });

    let userNamesToFind = _.map(messagesArray, 'receiver');

    let userNameFind = await usersModel.find({username: {$in: userNamesToFind}}, {name: 1, username: 1}).lean();

    messagesArray.forEach(finalMessage => {
        let nameFind = _.find(userNameFind, (find) => {
            return find.username == finalMessage.receiver;
        });

        finalMessage.to = nameFind.name;
    });

    return {
        msg: text,
        startDay: startDay,
        endDay: endDay,
        data: messagesArray
    }
}

const getAllThreads = async (start, end) => {

    const endDay = moment(end).add(1, 'day').startOf('day').format('YYYY-MM-DD'),
        startDay = moment(start).startOf('day').format('YYYY-MM-DD');

    let messagesArray = [],
        rids = [],
        findObject = {
            $or: [{dcount: {$gt: 0}}, {tcount: {$gt: 0}}],
            ts: {
                $gte: new Date(startDay + ' 00:00:00'),
                $lt: new Date(endDay + ' 00:00:00')
            }
        };


    console.log(findObject)

    let messages = await chatMessageModel.find(findObject).lean();

    if (!messages || messages.length === 0) {
        return {
            startDay: startDay,
            endDay: endDay,
            data: messagesArray
        }
    }

    messages.forEach(message => {
        messagesArray.push({
            id: messagesArray.length + 1,
            count: message.tcount || message.dcount,
            date: message.ts,
            message: message.msg
        });
    });

    return {
        startDay: startDay,
        endDay: endDay,
        data: messagesArray
    }
}

const getMessages = async (req, res) => {

    try {
        const dateFilter = req.query.date ? req.query.date : moment().format('YYYY-MM-DD'),
            textToFilter = req.query.msg ? `#${req.query.msg}` : '#target';

        if (dateFilter.length !== 10) {
            throw {message: 'Please send correct date format YYYY-MM-DD'};
        }

        let results = await getMessagesWithTarget(textToFilter, dateFilter);

        res.render('table', results)
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving messages."
        });
    }
}, getThreads = async (req, res) => {
    try {
        const start = req.query.start_date ? req.query.start_date : moment().format('YYYY-MM-DD'),
            end = req.query.end_date ? req.query.end_date : moment().format('YYYY-MM-DD');


        let results = await getAllThreads(start, end);

        console.log(results);
        res.render('threads', results)
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving messages."
        });
    }
}, getMessagesFromTo = async (req, res) => {
    try {
        const startDate = req.query.startDate ? req.query.startDate : moment().format('YYYY-MM-DD'),
            endDate = req.query.endDate ? req.query.endDate : moment().format('YYYY-MM-DD'),
            textToFilter = req.query.msg ? `${req.query.msg}` : '',
            userName1 = req.query.username1,
            userName2 = req.query.username2;

        let results = await getMessagesWithTargetFromTo(textToFilter, startDate, endDate, userName1, userName2);

        res.render('tableStartEnd', results)
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving messages."
        });
    }
}


module.exports = {
    getMessages,
    getThreads,
    getMessagesFromTo
}
