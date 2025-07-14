// utils/notificationTemplates.js
module.exports = {
  1: ({ followerUser }) => ({
    type: 1,
    title: `${followerUser.alias} comenzó a seguirte`,
    body: `¡Tienes un nuevo seguidor! ${followerUser.alias} (@${followerUser.userName}) ahora te sigue.`,
    link: `/u/${followerUser.userName}`,
  }),

  2: ({ game }) => ({
    type: 2,
    title: `Nuevo Save para "${game.title}"`,
    body: `Alguien ha añadido un nuevo save en tu juego favorito "${game.title}"`,
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


