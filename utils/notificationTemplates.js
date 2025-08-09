const { link } = require("../routes/api/savedatas");

// utils/notificationTemplates.js
module.exports = {

  //Nuevo Seguidor
  1: ({ followerUser }) => ({
    type: 1,
    title: `${followerUser.alias} now follows you.`,
    body: `You have a new follower! ${followerUser.alias} (@${followerUser.userName}) now follows you.`,
    link: `/u/${followerUser.userName}`,
  }),

  //Nuevo Save para un juego favorito
  2: ({ game }) => ({
    type: 2,
    title: `New upload for "${game.title}"`,
    body: `Check the new savedata uploaded to your favorite game "${game.title}".`,
    link: `/g/${game.slug}`,
  }),

  //Procesando el archivo subido
  3: ({ game }) => ({
    type: 3,
    title: `Processign your savedata`,
    body: `Your savedata for "${game.title}" is being checked for malicious content. We'll notify you when it's done!`,
  }),

  //El archivo se detectó como malicioso
  4: ({ game }) => ({
    type: 4,
    title: `Malicious content was detected`,
    body: `We have detected malicious content in your savedata for "${game.title}".`,
  }),

  //Archivo subido correctamente
  5: ({ savedata, game }) => ({
    type: 5,
    title: `Your savedata has been uploaded!`,
    body: `Your savedata "${savedata.title}" for "${game.title}" is clean and has been uploaded correctly`,
    link: `/s/${savedata.saveID}`
  }),

  //Error en la subida
    6: ({ game }) => ({
    type: 6,
    title: `An error occurred  while uploading your savedata`,
    body: `An unexpected error occurred while trying to upload your savedata for "${game.title}". Please try again`,
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


