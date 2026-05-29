const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/callback'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent'
});

const server = http.createServer(async (req, res) => {
  const code = new url.URL(req.url, 'http://localhost:3001').searchParams.get('code');
  if (!code) return;

  const { tokens } = await oauth2Client.getToken(code);
  
  console.log('\n✅ REFRESH TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('\nCopialo in .env come GOOGLE_REFRESH_TOKEN\n');
  
  res.end('✅ Token ottenuto! Puoi chiudere questa finestra.');
  server.close();
});

server.listen(3001, () => {
  console.log('\nAprendo il browser...');
  console.log('Se non si apre, vai su:\n', authUrl);
  require('child_process').exec(`start ${authUrl}`);
});
