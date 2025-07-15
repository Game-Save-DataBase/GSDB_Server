// utils/notificationTemplates.js
module.exports = {
  1: ({ followerUser }) => ({
    type: 1,
    title: `${followerUser.alias} now follows you.`,
    body: `You have a new follower! ${followerUser.alias} (@${followerUser.userName}) now follows you.`,
    link: `/u/${followerUser.userName}`,
  }),

  2: ({ game }) => ({
    type: 2,
    title: `New upload for "${game.title}"`,
    body: `Check the new savedata uploaded to your favorite game "${game.title}."`,
    link: `/g/${game.slug}`,
  }),

};

//otros tipos de ejemplo....

//   commentOnSave: ({ fromUserName, saveTitle, link }) => ({
//     type: 2,
//     title: `${fromUserName} comentó tu save`,
//     body: `Nuevo comentario en "${saveTitle}"`,
//     link: link,
//     createdAt: new Date().toISOString(),
//     read: false,
//   }),

//   likeOnSave: ({ fromUserName, saveTitle, link }) => ({
//     type: 2,
//     title: `${fromUserName} le dio like a tu save`,
//     body: `A "${saveTitle}" le gustó a ${fromUserName}`,
//     link,
//     createdAt: new Date().toISOString(),
//     read: false,
//   }),

//   adminMessage: ({ title, message }) => ({
//     type: 3,
//     title,
//     body: message,
//     createdAt: new Date().toISOString(),
//     read: false,
//   }),


