const express=require('express');
const {query}=require('../config/db');
const {auth,allow}=require('../middleware/auth');
const r=express.Router();

r.get('/',auth,allow('admin'),async(req,res)=>{
  try{
    const d=/^\d{4}-\d{2}-\d{2}$/.test(req.query.date||'')?req.query.date:new Date().toISOString().slice(0,10);
    const sales=Number((await query(`SELECT COALESCE(SUM(total_price),0)::float sales FROM orders WHERE DATE(created_at)=$1 AND status NOT IN ('rejected','cancelled')`,[d])).rows[0].sales||0);
    const transactions=(await query(`
      SELECT type,COALESCE(SUM(amount),0)::float amount
      FROM finance_transactions
      WHERE transaction_date=$1
      GROUP BY type
    `,[d])).rows;
    const categoryRows=(await query(`
      SELECT type,category,COALESCE(SUM(amount),0)::float amount
      FROM finance_transactions
      WHERE transaction_date=$1
      GROUP BY type,category
      ORDER BY amount DESC,category
    `,[d])).rows;
    const recent=(await query(`
      SELECT id,type,category,amount,note,transaction_date,created_at
      FROM finance_transactions
      WHERE transaction_date=$1
      ORDER BY created_at DESC,id DESC
      LIMIT 30
    `,[d])).rows;
    const sales7=(await query(`
      SELECT gs.day::date AS date,COALESCE(SUM(o.total_price),0)::float sales
      FROM generate_series(($1::date-6),$1::date,'1 day') gs(day)
      LEFT JOIN orders o ON DATE(o.created_at)=gs.day::date
        AND o.status NOT IN ('rejected','cancelled')
      GROUP BY gs.day::date
      ORDER BY gs.day::date
    `,[d])).rows;
    const otherIncome=Number(transactions.find(x=>x.type==='income')?.amount||0);
    const expense=Number(transactions.find(x=>x.type==='expense')?.amount||0);
    const totalIncome=sales+otherIncome;
    const net=totalIncome-expense;
    res.json({date:d,sales,otherIncome,expense,totalIncome,net,transactions,categoryRows,recent,sales7});
  }catch(e){
    console.error('[FINANCE GET ERROR]',e);
    res.status(500).json({error:'โหลดข้อมูลการเงินไม่สำเร็จ',detail:e.message});
  }
});

r.post('/',auth,allow('admin'),async(req,res)=>{
  try{
    const {type,category,amount,note,transaction_date}=req.body;
    if(!['income','expense'].includes(type))return res.status(400).json({error:'ประเภทบัญชีไม่ถูกต้อง'});
    if(!category?.trim() || !(Number(amount)>=0))return res.status(400).json({error:'กรอกหมวดหมู่และจำนวนเงินให้ถูกต้อง'});
    res.status(201).json((await query(`INSERT INTO finance_transactions(type,category,amount,note,transaction_date,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[type,category.trim(),Number(amount),note||'',transaction_date||new Date(),req.user.id])).rows[0]);
  }catch(e){
    console.error('[FINANCE POST ERROR]',e);
    res.status(500).json({error:'บันทึกรายการการเงินไม่สำเร็จ',detail:e.message});
  }
});
module.exports=r;
