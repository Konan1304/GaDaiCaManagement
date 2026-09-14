const {WebSocketServer,WebSocket}=require('ws');
const jwt=require('jsonwebtoken');
const {sql,getPool}=require('../config/db');
let wss;
function initialize(server){
 wss=new WebSocketServer({noServer:true,handleProtocols:protocols=>protocols.has('chat')?'chat':false});
 server.on('upgrade',async(req,socket,head)=>{try{if(new URL(req.url,'http://localhost').pathname!=='/ws/chat')return socket.destroy();const protocols=String(req.headers['sec-websocket-protocol']||'').split(',').map(x=>x.trim()),token=protocols[1];if(!token)return socket.destroy();const user=jwt.verify(token,process.env.JWT_SECRET);let branchId=null;if(user.role!=='admin'){const result=await (await getPool()).request().input('uid',sql.Int,user.userId).query('SELECT branch_id branchId FROM employees WHERE user_id=@uid');branchId=result.recordset[0]?.branchId;if(!branchId)return socket.destroy()}wss.handleUpgrade(req,socket,head,ws=>{ws.chatUser={...user,branchId};wss.emit('connection',ws,req)})}catch{socket.destroy()}});
 wss.on('connection',ws=>{ws.send(JSON.stringify({type:'connected'}));ws.on('error',()=>{})});
}
function publish(event){if(!wss)return;const payload=JSON.stringify(event);for(const client of wss.clients){const user=client.chatUser;if(client.readyState===WebSocket.OPEN&&(user?.role==='admin'||Number(user?.branchId)===Number(event.branchId)))client.send(payload)}}
module.exports={initialize,publish};
