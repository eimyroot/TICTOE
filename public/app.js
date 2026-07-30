const $ = (id) => document.getElementById(id)
const lobby = $('lobby'), arena = $('arena'), boardEl = $('board'), votePanel = $('votePanel')
let ws = null
let state = null
let me = { playerId: null, team: null, role: null, weight: null, isHost: false, name: null }
let clockTimer = null
let pingTimer = null
let serverInfo = null

function toast(text, error=false){const el=$('toast');el.textContent=text;el.className='toast show'+(error?' error':'');clearTimeout(el._t);el._t=setTimeout(()=>el.className='toast',2400)}
function wsUrl(){return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`}
function send(payload){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload));else toast('Server connection is not ready.',true)}
function setConn(ok,text){$('connDot').className='dot '+(ok?'ok':'bad');$('connText').textContent=text;$('netStatus').textContent=ok?'CONNECTED':'DISCONNECTED'}

function connect(){
  ws = new WebSocket(wsUrl())
  ws.addEventListener('open',()=>{setConn(true,'Arena server connected.'); if(pingTimer)clearInterval(pingTimer); pingTimer=setInterval(()=>send({type:'ping'}),15000)})
  ws.addEventListener('close',()=>{setConn(false,'Connection lost. Refresh to reconnect.');toast('Connection to server lost.',true);if(pingTimer)clearInterval(pingTimer)})
  ws.addEventListener('error',()=>setConn(false,'Could not connect to arena server.'))
  ws.addEventListener('message',(event)=>{
    let msg;try{msg=JSON.parse(event.data)}catch{return}
    if(msg.type==='error')return toast(msg.message,true)
    if(msg.type==='joined'){
      me={...me,playerId:msg.playerId,team:msg.team,role:msg.role,isHost:msg.isHost,name:me.name}
      lobby.classList.add('hidden');arena.classList.remove('hidden');$('roomLabel').textContent=msg.roomCode
      const u=new URL(location.href);u.searchParams.set('room',msg.roomCode);history.replaceState(null,'',u)
      toast(`Joined room ${msg.roomCode} as ${msg.role}`)
    }
    if(msg.type==='state'){state=msg.state;render()}
  })
}

$('createBtn').onclick=()=>{const name=$('createName').value.trim()||'HOST';me.name=name;send({type:'create_room',name})}
$('joinBtn').onclick=()=>{const name=$('joinName').value.trim()||'PLAYER';const roomCode=$('roomCode').value.trim().toUpperCase();const team=$('teamSelect').value;if(!roomCode)return toast('Enter a room code.',true);me.name=name;send({type:'join_room',name,roomCode,team})}
$('startBtn').onclick=()=>send({type:'start_match'})
$('nextRoundBtn').onclick=()=>send({type:'next_round'})
$('resetBtn').onclick=()=>{if(confirm('Reset score and board for everyone in this room?'))send({type:'reset_match'})}
$('copyLinkBtn').onclick=async()=>{let base=location.origin;if(['localhost','127.0.0.1','::1'].includes(location.hostname)&&serverInfo?.lanUrls?.length)base=serverInfo.lanUrls[0].url;const u=new URL(base);u.searchParams.set('room',state?.code||$('roomLabel').textContent);try{await navigator.clipboard.writeText(u.toString());toast('LAN-ready invite link copied.')}catch{prompt('Copy this invite link:',u.toString())}}
$('lockBtn').onclick=async()=>{try{await fetch('/api/logout',{method:'POST'});}finally{location.href='/'}}

function playerById(id){return state?.players?.find(p=>p.id===id)}
function isMyTurn(){return state && me.team===state.turn}
function canPropose(){return state?.phase==='PROPOSAL'&&isMyTurn()&&me.team!=='SPECTATOR'}
function canVote(){return state?.phase==='VOTING'&&isMyTurn()&&me.team!=='SPECTATOR'}
function coordLabel(x,y){return `${String.fromCharCode(65+x)}${y+1}`}

function render(){
  if(!state)return
  const mine=playerById(me.playerId)
  if(mine){me.team=mine.team;me.role=mine.role;me.weight=mine.weight;me.isHost=state.hostPlayerId===me.playerId;me.name=mine.name}
  $('roomLabel').textContent=state.code
  $('scoreX').textContent=state.scores.X;$('scoreO').textContent=state.scores.O;$('roundNo').textContent=state.round
  $('phaseLabel').textContent=state.phase
  $('railProposal').classList.toggle('active',state.phase==='PROPOSAL')
  $('railVoting').classList.toggle('active',state.phase==='VOTING')
  $('railExecution').classList.toggle('active',state.phase==='EXECUTION')
  $('meName').textContent=me.name||'—';$('meRole').textContent=me.role||'—';$('meWeight').textContent=me.weight??'—';$('meTeam').textContent=me.team||'—'
  renderRoster('rosterX','X');renderRoster('rosterO','O');renderRoster('rosterS','SPECTATOR');renderBoard();renderVotes();renderEvents();renderControls();renderInstruction();startClock()
}

function renderRoster(id,team){
  const el=$(id);const players=state.players.filter(p=>p.team===team)
  if(!players.length){el.innerHTML='<div class="event">No players yet.</div>';return}
  el.innerHTML=players.map(p=>`<div class="roster-player"><div><b>${esc(p.name)}</b><small>${p.id===state.hostPlayerId?'HOST · ':''}${esc(p.role)} · ×${p.weight}</small></div><span class="tag ${p.connected?'':'off'}">${p.connected?'ONLINE':'OFFLINE'}</span></div>`).join('')
}

function renderBoard(){
  boardEl.innerHTML=''
  const proposalMap=new Map((state.proposals||[]).map(p=>[`${p.x},${p.y}`,p]))
  const topMap=new Map((state.topProposals||[]).map((p,i)=>[`${p.x},${p.y}`,i]))
  const maxW=Math.max(1,...(state.proposals||[]).map(p=>p.weight))
  for(let y=0;y<state.gridSize;y++)for(let x=0;x<state.gridSize;x++){
    const b=document.createElement('button');b.className='cell';const piece=state.board[y][x]
    if(piece){const s=document.createElement('span');s.className=`piece ${piece.toLowerCase()}`;s.textContent=piece;b.appendChild(s)}
    const p=proposalMap.get(`${x},${y}`)
    if(!piece&&state.phase==='PROPOSAL'&&p){const h=document.createElement('span');h.className=`heat ${state.turn==='O'?'o':''}`;h.style.opacity=String(.4+.6*(p.weight/maxW));h.textContent=p.weight;b.appendChild(h)}
    if(!piece&&state.phase==='VOTING'&&topMap.has(`${x},${y}`)){const i=topMap.get(`${x},${y}`);const v=document.createElement('span');v.className='vote-mark';v.textContent=String.fromCharCode(65+i);b.appendChild(v)}
    if(state.myProposal===`${x},${y}`)b.classList.add('selected')
    b.disabled=!canPropose()||!!piece
    b.title=coordLabel(x,y)
    b.onclick=()=>send({type:'propose',x,y})
    boardEl.appendChild(b)
  }
}

function renderVotes(){
  if(state.phase!=='VOTING'||!state.topProposals?.length){votePanel.classList.add('hidden');votePanel.innerHTML='';return}
  votePanel.classList.remove('hidden')
  const numeric=(state.votes||[]).map(v=>typeof v==='number'?v:0), total=Math.max(1,numeric.reduce((a,b)=>a+b,0))
  votePanel.innerHTML=state.topProposals.map((p,i)=>{const hidden=state.votes?.[i]===null;const weight=hidden?null:numeric[i];const share=hidden?0:Math.round(weight/total*100);return `<button class="vote-card ${state.myVote===i?'selected':''}" data-i="${i}" ${canVote()?'':'disabled'}><strong><span>PROPOSAL ${String.fromCharCode(65+i)}</span><span>${coordLabel(p.x,p.y)}</span></strong><div class="bar"><i style="width:${share}%"></i></div><small>${hidden?'SEALED':`${weight} weighted votes · ${share}%`} · proposal ${p.proposalWeight}</small></button>`}).join('')
  votePanel.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>send({type:'vote',index:Number(btn.dataset.i)}))
}

function renderEvents(){
  $('events').innerHTML=(state.events||[]).slice(0,18).map(e=>`<div class="event"><time>${new Date(e.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>${esc(e.text)}</div>`).join('')||'<div class="event">No events yet.</div>'
}

function renderControls(){
  $('hostControls').classList.toggle('hidden',!me.isHost)
  $('startBtn').classList.toggle('hidden',!(me.isHost&&state.phase==='WAITING'))
  $('startBtn').disabled=!state.canStart
  $('nextRoundBtn').classList.toggle('hidden',!(me.isHost&&state.phase==='GAMEOVER'))
}

function renderInstruction(){
  const active=state.turn==='X'?'NEON WOLVES':'MAGENTA VOID'
  if(state.phase==='WAITING'){$('activeTeamText').textContent='LOBBY // WAITING';$('instruction').textContent=state.canStart?(me.isHost?'Both teams ready. Start the match.':'Both teams ready. Waiting for host.'): 'Need at least one Team X and one Team O player.';return}
  if(state.phase==='GAMEOVER'){$('activeTeamText').textContent=state.winner==='DRAW'?'ROUND DRAW':`TEAM ${state.winner} WINS`; $('instruction').textContent=me.isHost?'Start the next round when ready.':'Waiting for host to start next round.';return}
  $('activeTeamText').textContent=`${active} // TEAM ${state.turn} ACTIVE`
  if(state.phase==='PROPOSAL')$('instruction').textContent=canPropose()?`Click any empty cell. Your ${me.role} weight is ×${me.weight}.`:(me.team==='SPECTATOR'?'Spectator heatmap view.':'Opponent is privately proposing moves.')
  if(state.phase==='VOTING')$('instruction').textContent=canVote()?`Vote one of the Top ${state.topProposals.length}. You can change your vote until time expires.`:(me.team==='SPECTATOR'?'Spectator live voting view.':'Opponent voting is sealed from your team.')
  if(state.phase==='EXECUTION')$('instruction').textContent='Server has sealed the vote and is executing the authoritative board delta.'
}

function startClock(){
  if(clockTimer)clearInterval(clockTimer)
  const tick=()=>{if(!state?.deadline){$('clock').textContent='--';return}const left=Math.max(0,state.deadline-Date.now());$('clock').textContent=(left/1000).toFixed(left<10000?1:0)}
  tick();clockTimer=setInterval(tick,100)
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

const presetRoom=new URL(location.href).searchParams.get('room')
if(presetRoom)$('roomCode').value=presetRoom.toUpperCase()
fetch('/api/info').then(r=>r.json()).then(info=>{serverInfo=info;if(info.lanUrls?.length)$('lanHint').textContent=`Same-network players can open: ${info.lanUrls.map(x=>x.url).join(' · ')}`}).catch(()=>{})
connect()
