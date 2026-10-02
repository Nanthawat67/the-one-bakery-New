const express=require('express');const {query}=require('../config/db');const {auth}=require('../middleware/auth');const r=express.Router();
r.get('/',auth,async(req,res)=>res.json((await query(`SELECT * FROM notifications WHERE (recipient_user=$1 OR recipient_role=$2 OR recipient_role IS NULL) ORDER BY created_at DESC LIMIT 50`,[req.user.id,req.user.role])).rows));
r.patch('/:id/read',auth,async(req,res)=>res.json((await query(`UPDATE notifications SET read_at=NOW() WHERE id=$1 AND (recipient_user=$2 OR recipient_role=$3 OR recipient_role IS NULL) RETURNING *`,[req.params.id,req.user.id,req.user.role])).rows[0]||{}));
module.exports=r;
