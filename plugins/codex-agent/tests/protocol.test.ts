import test from 'node:test'
import assert from 'node:assert/strict'
import { CodexAppServerClient } from '../src/protocol.js'

const script = "process.stdin.setEncoding('utf8'); let buffer=''; process.stdin.on('data', chunk => { buffer += chunk; for (;;) { const end=buffer.indexOf('\\n'); if (end < 0) break; const line=buffer.slice(0,end); buffer=buffer.slice(end+1); const m=JSON.parse(line); if (m.method === 'notify') process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'codex/event',params:{event_id:'e1',value:1}})+'\\n'); else if (m.method !== 'hang') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{method:m.method}})+'\\n'); } });"

test('correlates responses and forwards notifications', async () => {
  const events: string[] = []
  const client = new CodexAppServerClient({ command: process.execPath, args: ['-e', script], onNotification: event => events.push(event.method) })
  try {
    assert.deepEqual(await client.request('ping'), { method: 'ping' })
    client.notify('notify')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.deepEqual(events, ['codex/event'])
  } finally { await client.close() }
})

test('times out requests and rejects requests after close', async () => {
  const client = new CodexAppServerClient({ command: process.execPath, args: ['-e', script] })
  await assert.rejects(client.request('hang', undefined, 10), /timed out/)
  await client.close()
  await assert.rejects(client.request('after-close'), /closed/)
})
