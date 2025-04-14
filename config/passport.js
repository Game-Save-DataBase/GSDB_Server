const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy; //por ahora solamente local
const bcrypt = require('bcryptjs'); //para desencriptar de la bbdd
const User = require('../models/Users');

passport.use(
    //creamos nueva estrategia local. como campo usamos mail (o userName!!)
    new LocalStrategy({ usernameField: 'identifier' }, async (identifier, password, done) => {
        try {
            //buscamos en bbdd un usuario que coincida con mail. como en el modelo, mail es "unique", solo puede haber uno
            const user = await User.findOne({
                $or: [{ mail: identifier }, { userName: identifier }]
            });

            if (!user) return done(null, false, { message: 'Usuario no encontrado' });
            //desencriptamos
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return done(null, false, { message: 'Contraseña incorrecta' });

            //devuelve exito
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    })
);

//serializar usuario = guardar el _id del usuario para la sesion, para poder rastrear la sesion
passport.serializeUser((user, done) => {
    done(null, user._id);
});
//con la propiedad _id de un usuario, buscamos si es el que esta autenticado y asi devolver exito o error
//para poder acceder a zonas protegidas
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
