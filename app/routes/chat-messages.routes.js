const controller = require('../controllers/chat-messages.controller.js');

module.exports = (app) => {
    // Get messages
    app.post('/todayChatMessages', controller.getMessages);
}