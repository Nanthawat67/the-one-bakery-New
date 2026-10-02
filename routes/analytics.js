const express=require('express');
const {query}=require('../config/db');
const {auth,allow}=require('../middleware/auth');
const r=express.Router();

const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);

r.get('/sales',auth,allow('admin'),asyncHandler(async(req,res)=>{
  const days=Math.min(Number(req.query.days)||30,365);
  const daily=(await query(`SELECT DATE(created_at) AS order_day,COUNT(*)::int AS orders,COALESCE(SUM(total_price),0)::float AS sales
    FROM orders
    WHERE status NOT IN ('rejected','cancelled')
      AND created_at>=CURRENT_DATE-$1::int
    GROUP BY 1 ORDER BY 1`,[days])).rows;
  const top=(await query(`SELECT p.name,SUM(oi.quantity)::int quantity,ROUND(SUM(oi.quantity*oi.unit_price),2)::float sales
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    JOIN products p ON p.id=oi.product_id
    WHERE o.status NOT IN ('rejected','cancelled')
      AND o.created_at>=CURRENT_DATE-$1::int
    GROUP BY p.name ORDER BY quantity DESC LIMIT 10`,[days])).rows;
  res.json({daily,top});
}));

r.get('/association',auth,allow('admin'),asyncHandler(async(req,res)=>{
  const orders=(await query(`SELECT oi.order_id,p.name
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    JOIN products p ON p.id=oi.product_id
    WHERE o.status NOT IN ('rejected','cancelled')
    ORDER BY oi.order_id`)).rows;
  const by={};
  for(const x of orders)(by[x.order_id]??=[]).push(x.name);
  const total=Object.keys(by).length,pairs={};
  for(const items of Object.values(by)){
    const u=[...new Set(items)];
    for(let i=0;i<u.length;i++)for(let j=i+1;j<u.length;j++){
      const k=[u[i],u[j]].sort().join('|||');
      pairs[k]=(pairs[k]||0)+1;
    }
  }
  const counts={};
  for(const items of Object.values(by))for(const x of new Set(items))counts[x]=(counts[x]||0)+1;
  const result=Object.entries(pairs).map(([k,s])=>{
    const [a,b]=k.split('|||');
    const confAB=s/counts[a],confBA=s/counts[b];
    const lift=total?(s/total)/((counts[a]/total)*(counts[b]/total)):0;
    return {a,b,support:+(s/total).toFixed(3),confidence_a_to_b:+confAB.toFixed(3),confidence_b_to_a:+confBA.toFixed(3),lift:+lift.toFixed(3)};
  }).sort((a,b)=>b.lift-a.lift);
  res.json(result.slice(0,20));
}));

r.get('/production-recommendation',auth,allow('admin'),asyncHandler(async(req,res)=>{
  const days=Math.min(Number(req.query.days)||30,365);
  const rows=(await query(`SELECT p.id,p.name,COALESCE(SUM(oi.quantity),0)::int quantity
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id=p.id
    LEFT JOIN orders o ON o.id=oi.order_id
      AND o.status NOT IN ('rejected','cancelled')
      AND o.created_at>=CURRENT_DATE-$1::int
    WHERE p.active=true
    GROUP BY p.id,p.name
    ORDER BY quantity DESC,p.name`,[days])).rows;
  res.json(rows.map(x=>({
    id:x.id,name:x.name,quantity:Number(x.quantity),
    avg_daily_quantity:+(Number(x.quantity)/Math.max(days,1)).toFixed(1),
    recommended_quantity:Math.max(0,Math.ceil(Number(x.quantity)/Math.max(days,1)))
  })).filter(x=>x.quantity>0));
}));

r.get('/forecast',auth,allow('admin'),asyncHandler(async(req,res)=>{
  const days=Math.min(Number(req.query.days)||30,365);
  const data=(await query(`SELECT DATE(created_at) AS order_day,COALESCE(SUM(total_price),0)::float AS sales,COUNT(*)::int AS orders
    FROM orders
    WHERE status NOT IN ('rejected','cancelled')
      AND created_at>=CURRENT_DATE-$1::int
    GROUP BY 1 ORDER BY 1`,[days])).rows;
  const vals=data.map(x=>x.sales),n=vals.length,k=Math.min(7,n||1);
  const mean=vals.slice(-k).reduce((a,b)=>a+b,0)/k;
  let sx=0,sy=0,sxx=0,sxy=0;
  vals.forEach((y,i)=>{sx+=i;sy+=y;sxx+=i*i;sxy+=i*y});
  const slope=n>1?(n*sxy-sx*sy)/(n*sxx-sx*sx):0;
  const intercept=n?(sy-slope*sx)/n:0;
  const forecast=Array.from({length:7},(_,i)=>Math.max(0,intercept+slope*(n+i)));
  const mae=n?vals.reduce((a,v,i)=>a+Math.abs(v-(intercept+slope*i)),0)/n:0;
  const rmse=n?Math.sqrt(vals.reduce((a,v,i)=>a+(v-(intercept+slope*i))**2,0)/n):0;
  res.json({
    history:data,
    models:[
      {name:'7-day Moving Average',mae:null,rmse:null,next7:forecast.map(()=>mean)},
      {name:'Linear Trend Baseline',mae:+mae.toFixed(2),rmse:+rmse.toFixed(2),next7:forecast.map(v=>+v.toFixed(2))}
    ],
    recommendation:forecast.map(v=>Math.round(v)).reduce((a,b)=>a+b,0)/7
  });
}));

r.use((err,req,res,next)=>{
  console.error('ANALYTICS API ERROR:',err);
  if(res.headersSent) return next(err);
  res.status(500).json({error:'ไม่สามารถโหลดข้อมูล Analytics ได้',detail:process.env.NODE_ENV==='development'?err.message:undefined});
});

module.exports=r;
