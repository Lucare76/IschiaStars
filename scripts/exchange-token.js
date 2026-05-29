const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Inserisci il code ottenuto da Google: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Token ottenuti:\n');
    console.log(tokens);
    if (tokens.refresh_token) {
      console.log('\n🔑 Copia questo valore in .env come GOOGLE_REFRESH_TOKEN=...\n');
    }
  } catch (err) {
    console.error('Errore durante lo scambio del code:', err);
  } finally {
    rl.close();
  }
});
