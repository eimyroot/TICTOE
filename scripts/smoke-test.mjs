import { spawn } from 'node:child_process'
import net from 'node:net'
import crypto from 'node:crypto'

const port = 18787 + Math.floor(Math.random() * 1000)
const base = `http://127.0.0.1:${port}`
const password = 'smoke-test-password'
const secret = 'smoke-test-session-secret-that-is-long-enough'
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', T3A_ACCESS_PASSWORD: password, T3A_SESSION_SECRET: secret },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stderr = ''
child.stderr.on('data', d => stderr += d)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitHealth(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(`${base}/health`);if(r.ok)return await r.json()}catch{}
    await sleep(100)
  }
  throw new Error('Health endpoint did not become ready')
}

function rawWsHandshake(cookie=''){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:'127.0.0.1',port},()=>{
      const key=crypto.randomBytes(16).toString('base64')
      const lines=[
        'GET /ws HTTP/1.1',
        `Host: 127.0.0.1:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
      ]
      if(cookie) lines.push(`Cookie: ${cookie}`)
      socket.write(lines.join('\r\n')+'\r\n\r\n')
    })
    let data=''
    const timer=setTimeout(()=>{socket.destroy();reject(new Error('WS handshake timeout'))},2500)
    socket.on('data',chunk=>{
      data+=chunk.toString('latin1')
      if(data.includes('\r\n\r\n')){clearTimeout(timer);const line=data.split('\r\n')[0];socket.destroy();resolve(line)}
    })
    socket.on('error',err=>{clearTimeout(timer);reject(err)})
  })
}

try{
  const health=await waitHealth()
  if(!health.ok || !health.protected) throw new Error('Health check invalid')

  const protectedPage=await fetch(`${base}/`,{redirect:'manual'})
  if(protectedPage.status!==401) throw new Error(`Expected protected root 401, got ${protectedPage.status}`)

  const bad=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'wrong'})})
  if(bad.status!==401) throw new Error(`Expected bad login 401, got ${bad.status}`)

  const login=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})})
  if(!login.ok) throw new Error(`Login failed: ${login.status}`)
  const setCookie=login.headers.get('set-cookie')||''
  const cookie=setCookie.split(';')[0]
  if(!cookie.startsWith('t3a_session=')) throw new Error('Session cookie missing')

  const info=await fetch(`${base}/api/info`,{headers:{cookie}})
  if(!info.ok) throw new Error(`Authenticated info failed: ${info.status}`)

  const unauthWs=await rawWsHandshake('')
  if(!unauthWs.includes('401')) throw new Error(`Expected unauth WS 401, got ${unauthWs}`)
  const authWs=await rawWsHandshake(cookie)
  if(!authWs.includes('101')) throw new Error(`Expected auth WS 101, got ${authWs}`)

  console.log(`SMOKE_TEST=PASS health=${health.version} auth=PASS websocket=PASS`)
} catch(err){
  console.error('SMOKE_TEST=FAIL',err.message)
  if(stderr.trim())console.error(stderr.trim())
  process.exitCode=1
} finally {
  child.kill('SIGTERM')
  await sleep(150)
}
