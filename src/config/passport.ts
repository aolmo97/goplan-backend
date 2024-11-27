import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User';

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.API_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Buscar usuario existente
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // Crear nuevo usuario si no existe
          user = new User({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            settings: {
              notifications: {
                enabled: true,
                chatMessages: true,
                planUpdates: true,
                reminders: true,
              },
              privacy: {
                shareLocation: true,
                publicProfile: true,
              },
            },
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Facebook OAuth Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: `${process.env.API_URL}/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'picture'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Buscar usuario existente
        let user = await User.findOne({ facebookId: profile.id });

        if (!user) {
          // Crear nuevo usuario si no existe
          user = new User({
            facebookId: profile.id,
            email: profile.emails?.[0]?.value,
            name: `${profile.name?.givenName} ${profile.name?.familyName}`,
            avatar: profile.photos?.[0]?.value,
            settings: {
              notifications: {
                enabled: true,
                chatMessages: true,
                planUpdates: true,
                reminders: true,
              },
              privacy: {
                shareLocation: true,
                publicProfile: true,
              },
            },
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;
