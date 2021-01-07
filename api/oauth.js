const queryString = require('query-string');

const fitbitClientId = process.env.FITBIT_CLIENT_ID;
const fitbitClientSecret = process.env.FITBIT_CLIENT_SECRET;

// Implicit OAuth 2.0 Flow
module.exports = async (req, res) => {
  if (!fitbitClientId) {
    res.write('Vercel variable FITBIT_CLIENT_ID not set.')
    res.end();
    return;
  }

  const host = req.headers['x-forwarded-host'];
  const protocol = req.headers['x-forwarded-proto'];
  if (!host || !protocol) {
    res.write('No x-forwarded-* headers (should be there with Vercel?)')
    res.end();
    return;
  }

  const qs = queryString.stringify({
    client_id: fitbitClientId,
    response_type: 'token',
    expires_in: 31536000,
    scope: 'sleep heartrate',
    redirect_uri: `${protocol}://${host}/api/oauth-callback`
  });
  const redirectUrl = `https://www.fitbit.com/oauth2/authorize?${qs}`;
  res.writeHead(302, { 'Location': redirectUrl });
  res.end();
};

// TODO: Can't use Auth Code Flow for this because the token expires in just 8 hours
// and we have no way to refresh on vercel
// const passport = require('passport');
// const refresh = require('passport-oauth2-refresh');
// const { FitbitOAuth2Strategy } = require( 'passport-fitbit-oauth2' );;
// const fitbitStrategy = new FitbitOAuth2Strategy({
//     clientID:     fitbitClientId,
//     clientSecret: fitbitClientSecret,
//     callbackURL: "http://localhost:4433/api/oauth" // Just some junk URL to grab the token with
//   }, function(accessToken, refreshToken, profile, done) {
//     console.log(profile.id);
//     console.log(accessToken);
//     console.log(refreshToken);
//     return done(null, {
//       id: profile.id,
//       token: accessToken
//     });
//   }
// );

// passport.use(fitbitStrategy);
// refresh.use(fitbitStrategy);


// module.exports = (req, res) => {
//   const { code } = req.query;
//   if (!code) {
//     // Run the middleware to OAuth into FitBit
//     console.log('ONE');
//     passport.authenticate('fitbit', { scope: ['sleep'] })(req, res, res.end.bind(res, undefined));
//   }
//   else {
//     // We're being redirected from FitBit, do part 2
//     console.log('TWO');
//     passport.authenticate('fitbit', { 
//       successRedirect: '/auth/fitbit/success',
//       failureRedirect: '/auth/fitbit/failure',
//       failureFlash: true
//     })(req, res, res.end.bind(res, undefined));
//     //passport.authenticate('fitbit')(req, res, ()=>{});
//     // refresh.requestNewAccessToken('facebook', 'some_refresh_token', function(err, accessToken, refreshToken) {
//   }
//   // res.writeHead(200, { 'Content-Type': 'text/plain' });
//   // res.end('ok');
// }