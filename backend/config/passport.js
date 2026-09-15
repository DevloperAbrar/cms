const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const prisma = require('./prismaClient');
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
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            return done(null, false, { message: 'No email returned from Google.' });
          }

          // Find user by email — must already exist in DB (created by a college's superadmin).
          // NOTE: email is unique PER COLLEGE in Postgres, not globally, so if the same
          // email is ever registered at two different colleges this picks the first match.
          // Fine for now since nothing in the OAuth flow carries a college code yet.
          const user = await prisma.user.findFirst({
            where: { email },
            include: { college: true },
          });

          if (!user) {
            logger.warn(`Google OAuth: no user found for email ${email}`);
            return done(null, false, {
              message: 'Account not found. Contact your administrator.',
            });
          }

          if (user.status !== 'active') {
            return done(null, false, {
              message: 'Your account is inactive. Contact your administrator.',
            });
          }

          if (user.college.lifecycleStatus === 'purged' || user.college.lifecycleStatus === 'soft_deleted') {
            return done(null, false, {
              message: 'This college account has been deactivated. Contact the platform administrator.',
            });
          }

          // Update googleId and lastLogin on first OAuth (and every login thereafter)
          const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: user.googleId || profile.id,
              lastLogin: new Date(),
            },
          });

          return done(null, updated);
        } catch (error) {
          logger.error(`Google OAuth error: ${error.message}`);
          return done(error, null);
        }
      }
    )
  );

  // Passport serialize / deserialize (used only during the OAuth redirect flow)
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

module.exports = configurePassport;