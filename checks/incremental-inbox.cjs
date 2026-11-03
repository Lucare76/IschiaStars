const fs = require('fs'), ts = require('typescript'), assert = require('assert/strict');
let cursor, validity='1', uids=[1,2,3], fetched=[], fail=false;
const ledger=new Map();
const db={from(table){let key,update;const q={select(){return q},contains(){return q},limit(){return q},eq(k,v){key=v;return q},async maybeSingle(){return {data:table==='settings'?(cursor?{value:cursor}:null):ledger.get(key),error:null}},async insert(v){ledger.set(v.gmail_message_id,{status:v.status,metadata:v.metadata});return {error:null}},update(v){update=v;return q},then(resolve){if(table==='email_import_ledger')ledger.set(key,update);resolve({data:[],error:null})},async upsert(v){if(table==='settings')cursor=v.value;return {error:null}}};return q}};
class Imap { constructor(){this.mailbox={uidValidity:validity}} async connect(){} async getMailboxLock(){return {release(){}}} async search(){return uids} async *fetch(ids){for(const uid of ids){fetched.push(uid);yield {uid,source:Buffer.from(String(uid))}}} async logout(){} }
const e={};new Function('require','exports',ts.transpileModule(fs.readFileSync('lib/imapParser.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='server-only'?{}:name==='crypto'?require('crypto'):name==='imapflow'?{ImapFlow:Imap}:name==='mailparser'?{simpleParser:async b=>{if(fail)throw Error('parse unavailable');return {messageId:'msg'+b,text:'ordinary mail',subject:'hello'}}}:name.includes('supabase')?{createSupabaseAdminClient:()=>db}:{},e);
Object.assign(process.env,{MAIL_INBOX_HOST:'test',MAIL_INBOX_USER:'test',MAIL_INBOX_PASSWORD:'test'});
(async()=>{
let r=await e.pollImapInbox();assert.equal(r.errors.length,0);assert.equal(cursor.lastUid,3);
fetched=[];await e.pollImapInbox();assert.deepEqual(fetched,[]);
// Migrating an existing backlog: newest 20 are processed first, then oldest 20.
uids=Array.from({length:100},(_,i)=>i+1);cursor={uidValidity:'1',lastUid:3,since:new Date().toISOString()};fetched=[];
await e.pollImapInbox();assert.deepEqual(fetched.slice(0,20),Array.from({length:20},(_,i)=>i+81));assert.equal(cursor.priorityUid,100);assert.equal(cursor.lastUid,23);
// A new arrival is never queued behind old messages.
uids.push(101);fetched=[];await e.pollImapInbox();assert.equal(fetched[0],101);assert.equal(cursor.priorityUid,101);assert.equal(cursor.lastUid,43);
// A failed recent message prevents both cursors from passing it.
uids.push(102);fail=true;r=await e.pollImapInbox();assert.equal(cursor.priorityUid,101);assert.equal(cursor.lastUid,43);assert.equal(r.errors.length,1);
fail=false;await e.pollImapInbox();assert.equal(cursor.priorityUid,102);assert.equal(cursor.lastUid,63);
// Drain recovery without skipping any UID.
await e.pollImapInbox();await e.pollImapInbox();assert.equal(cursor.lastUid,102);
fetched=[];await e.pollImapInbox();assert.deepEqual(fetched,[]);
validity='2';uids=[1,2];await e.pollImapInbox();assert.equal(cursor.uidValidity,'2');assert.equal(cursor.lastUid,2);
console.log('PASS recent-first, separate cursors, new mail ahead of backlog, failure and retry, full backlog recovery, no repeat, UIDVALIDITY reset');
})().catch(e=>{console.error(e);process.exit(1)});
