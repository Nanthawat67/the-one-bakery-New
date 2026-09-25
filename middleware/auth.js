const jwt=require('jsonwebtoken');
function auth(req,res,next){try{const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) return res.status(401).json({error:'กรุณาเข้าสู่ระบบ'}); req.user=jwt.verify(h.slice(7),process.env.JWT_SECRET); next();}catch{return res.status(401).json({error:'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'});}}
const allow=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'ไม่มีสิทธิ์ใช้งานส่วนนี้'});
module.exports={auth,allow};
