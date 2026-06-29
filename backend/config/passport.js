const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');
const { USER_STATUS } = require('./constants');
const logger = require('../utils/logger');

const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(null, false, { message: 'No email returned from Google.' });
          }

          // Find user by email — must already exist in DB (created by superadmin)
          const user = await User.findOne({ email: email.toLowerCase() });

          if (!user) {
            logger.warn(`Google OAuth: no user found for email ${email}`);
            return done(null, false, {
              message: 'Account not found. Contact your administrator.',
            });
          }

          if (user.status !== USER_STATUS.ACTIVE) {
            return done(null, false, {
              message: 'Your account is inactive. Contact your administrator.',
            });
          }

          // Update google_id and last_login on first OAuth
          if (!user.google_id) {
            user.google_id = profile.id;
          }
          user.last_login = new Date();
          await user.save();

          return done(null, user);
        } catch (error) {
          logger.error(`Google OAuth error: ${error.message}`);
          return done(error, null);
        }
      }
    )
  );

  // Passport serialize / deserialize (used only during the OAuth redirect flow)
  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-__v');
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

module.exports = configurePassport;