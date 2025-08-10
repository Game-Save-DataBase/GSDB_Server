const notificationTemplates = require('../utils/notificationTemplates');
const mongoose = require('mongoose');

async function sendNotification({ userIDs, type, args }) {
  const { Users } = require('../models/Users'); //<- aqui dentro por las dependencias circulares
  const templateFn = notificationTemplates[type];
  if (!templateFn) throw new Error(`Unknown notification type: ${type}`);
  const notification = {
    ...templateFn(args),
    _id: new mongoose.Types.ObjectId(),
    type,
    read: false,
    createdAt: new Date()
  };

  const users = await Users.find({ userID: { $in: userIDs } });
  for (const user of users) {
    const exists = user.notifications.some(n =>
      n.type === notification.type &&
      n.title === notification.title &&
      n.body === notification.body &&
      (notification.link ? n.link === notification.link : true)
    );

    if (!exists) {
      user.notifications.push(notification);
      await user.save();
    }
  }
}

module.exports = { sendNotification };
