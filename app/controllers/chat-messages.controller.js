const moment = require('moment'),
    chatMessageModel = mongoose.model('rocketchat-message', new mongoose.Schema({})),
    roomModel = mongoose.model('rocketchat-room', new mongoose.Schema({})),
    usersModel = mongoose.model('users', new mongoose.Schema({})),
    _ = require('lodash');

const getMessagesWithTarget = async (text, date) => {

    const nextDay = moment(date).add(1, 'day').format('YYYY-MM-DD');

    let messagesArray = [],
        rids = [];

    let messages = await chatMessageModel.find({
        msg: {'$regex': text}, ts: {
            $gte: date + ' 00:00:00',
            $lt: nextDay + ' 00:00:00'
        }
    });

    if (!messages || messages.length === 0) {
        return {message: "No data found for " + date, data: messagesArray};
    }

    rids = _.map(messages, 'rid');

    let getRoomData = await roomModel.find({
        _id: {$in: rids}
    });

    messages.forEach(message => {

        let roomData = _.find(getRoomData, (r) => {
            return r._id === messages.rid;
        });

        if (roomData.usersCount === 2) {
            messagesArray.push({
                from: message.u.name,
                to: '',
                receiver: roomData.usernames[0] == message.u.username ? roomData.usernames[1] : roomData.usernames[0],
                date: message.ts,
                message: message.msg
            });
        }
    });

    let userNamesToFind = _.find(messagesArray, 'receiver');

    let userNameFind = await usersModel.find({username: {$in: userNamesToFind}}, {name: 1, username: 1});

    messagesArray.forEach(finalMessage => {
        let nameFind = _.find(userNameFind, (find) => {
            return find.username == finalMessage.receiver;
        });

        finalMessage.to = nameFind.name;
    });

    return {message: "Data found " + date, data: messagesArray};
}

const getMessages = async (req, res) => {

    try {
        const dateFilter = req.body.date ? req.body.date : moment().format('YYYY-MM-DD'),
            textToFilter = req.body.msg ? req.body.msg : '#target';

        if (dateFilter.length !== 10) {
            throw {message: 'Please send correct date format YYYY-MM-DD'};
        }

        let results = await getMessagesWithTarget(textToFilter, dateFilter);

        res.send(results);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving messages."
        });
    }
}


module.exports = {
    getMessages
}
