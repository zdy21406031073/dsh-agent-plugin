import test from 'node:test'
import assert from 'node:assert/strict'
import { CodexAppServerClient } from '../src/protocol.js'

const script = "process.stdin.setEncoding('utf8'); let b=''; process.stdin.on('data', c => { b+=c; for (;;) { const i=b.indexOf('\\n'); if(i<0)break; const m=JSON.parse(b.slice(0,i)); b=b.slice(i+1); if(m.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{}})+'\\n'); else if(m.method==='ask') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:99,method:'approval',params:{}})+'\\n'); else if(m.id===99) process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:2,result:{accepted:true}})+'\\n'); } });"

test('responds to server requests through the injected handler', async () => {
  const client = new CodexAppServerClient({ command: process.execPath, args: ['-e', script], onRequest: message => {
    assert.equal(message.method, 'approval')
    return { accepted: true }
  } })
  try {
    await client.request('ask')
    await new Promise(resolve => setTimeout(resolve, 20))
  } finally { await client.close() }
})
