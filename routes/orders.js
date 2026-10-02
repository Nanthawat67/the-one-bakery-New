const express=require('express'); const {query,pool}=require('../config/db'); const {auth,allow}=require('../middleware/auth'); const r=express.Router();
const FLOW=['pending_review','confirmed','in_production','ready_for_packing','packed','picked_up'];
const LABEL={pending_review:'รอตรวจสอบ',confirmed:'ยืนยันออเดอร์',in_production:'กำลังผลิต',ready_for_packing:'รอแพ็ก',packed:'แพ็กเสร็จ',picked_up:'ลูกค้ารับสินค้าแล้ว',rejected:'ปฏิเสธออเดอร์',cancelled:'ยกเลิก'};
const LEGACY_STATUS={'รอตรวจสอบ':'pending_review','ยืนยันออเดอร์':'confirmed','กำลังผลิต':'in_production','รอแพ็ก':'ready_for_packing','แพ็กเสร็จ':'packed','ลูกค้ารับสินค้าแล้ว':'picked_up','ปฏิเสธออเดอร์':'rejected','ปฏิเสธ':'rejected','ยกเลิก':'cancelled'};
function normalizeStatus(s){const v=String(s??'').trim(); return LEGACY_STATUS[v]||v;}
async function notify(c,role,title,message,orderId,key){await c.query(`INSERT INTO notifications(recipient_role,type,title,message,order_id,dedupe_key) VALUES($1,'order', $2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING`,[role,title,message,orderId,key]);}
async function consumeInventoryForOrder(c, orderId, changedBy) {
  // Inventory is consumed when production is marked complete / sent to Packing.
  // The transaction makes the deduction atomic and the movement history prevents duplicate consumption.
  const already = await c.query(
    `SELECT 1 FROM inventory_movements
     WHERE order_id=$1 AND movement_type='production_consumption'
     LIMIT 1`,
    [orderId]
  );
  if (already.rowCount) return { consumed: false, alreadyConsumed: true, movements: [] };

  const rows = (await c.query(`
    SELECT
      r.ingredient_id,
      i.name AS ingredient_name,
      i.unit,
      SUM(r.quantity * oi.quantity)::numeric AS required_qty,
      STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS product_names
    FROM order_items oi
    JOIN products p ON p.id=oi.product_id
    JOIN recipes r ON r.product_id=oi.product_id
    JOIN inventory i ON i.id=r.ingredient_id
    WHERE oi.order_id=$1
    GROUP BY r.ingredient_id,i.name,i.unit
    ORDER BY r.ingredient_id
  `,[orderId])).rows;

  const movements=[];
  for (const row of rows) {
    const locked=(await c.query(
      `SELECT id,name,unit,stock FROM inventory WHERE id=$1 FOR UPDATE`,
      [row.ingredient_id]
    )).rows[0];
    if (!locked) throw Error(`ไม่พบวัตถุดิบ ${row.ingredient_name}`);
    const required=Number(row.required_qty);
    const stock=Number(locked.stock);
    if (stock < required) {
      const e=Object.assign(
        new Error(`วัตถุดิบ ${locked.name} ไม่เพียงพอสำหรับการผลิตออเดอร์นี้`),
        { code:'MATERIALS_AT_PRODUCTION', details:[{
          ingredient:locked.name,
          need:required,
          stock,
          unit:locked.unit
        }] }
      );
      throw e;
    }
    await c.query(
      `UPDATE inventory
       SET stock=stock-$1, updated_at=NOW()
       WHERE id=$2`,
      [required,locked.id]
    );
    await c.query(
      `INSERT INTO inventory_movements
       (order_id,product_id,ingredient_id,movement_type,quantity,unit,note,created_by)
       VALUES($1,NULL,$2,'production_consumption',$3,$4,$5,$6)`,
      [
        orderId,
        locked.id,
        required,
        locked.unit,
        `ตัด Stock จากการผลิต: ${row.product_names || 'สินค้าในออเดอร์'}`,
        changedBy || null
      ]
    );
    movements.push({ingredient:locked.name,quantity:required,unit:locked.unit});
  }
  return { consumed: movements.length>0, alreadyConsumed:false, movements };
}
async function checkResources(c,items){const out=[]; for(const item of items){const rows=await c.query(`SELECT p.name,i.id ingredient_id,i.name ingredient,i.unit,r.quantity,i.stock FROM recipes r JOIN products p ON p.id=r.product_id JOIN inventory i ON i.id=r.ingredient_id WHERE p.id=$1 FOR UPDATE OF i`,[item.product_id]); for(const x of rows.rows){const need=Number(x.quantity)*Number(item.quantity); if(Number(x.stock)<need) out.push({product:x.name,ingredient:x.ingredient,need,stock:Number(x.stock),unit:x.unit});}} return out;}
async function dailyOrderNo(c,id){const q=await c.query(`SELECT COUNT(*)::int AS daily_no FROM orders o2 JOIN orders target ON target.id=$1 WHERE (o2.created_at AT TIME ZONE 'Asia/Bangkok')::date=(target.created_at AT TIME ZONE 'Asia/Bangkok')::date AND (o2.created_at,o2.id)<=(target.created_at,target.id)`,[id]);return q.rows[0]?.daily_no||0;}
async function getOrder(c,id){
  return (await c.query(`
    WITH numbered AS (
      SELECT o.*,
             ROW_NUMBER() OVER (
               PARTITION BY (o.created_at AT TIME ZONE 'Asia/Bangkok')::date
               ORDER BY o.created_at,o.id
             )::int AS daily_no,
             (o.created_at AT TIME ZONE 'Asia/Bangkok')::date AS order_date
      FROM orders o
    )
    SELECT n.*,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id',oi.id,
               'product_id',oi.product_id,
               'name',p.name,
               'quantity',oi.quantity,
               'unit_price',oi.unit_price
             ) ORDER BY oi.id)
             FROM order_items oi
             LEFT JOIN products p ON p.id=oi.product_id
             WHERE oi.order_id=n.id
           ),'[]'::json) AS items
    FROM numbered n
    WHERE n.id=$1
  `,[id])).rows[0];
}
r.post('/',async(req,res)=>{const {customer_name,phone,items}=req.body; if(!customer_name||!phone||!Array.isArray(items)||!items.length)return res.status(400).json({error:'ข้อมูลออเดอร์ไม่ครบ'}); const c=await pool.connect(); try{await c.query('BEGIN'); await c.query(`CREATE TABLE IF NOT EXISTS production_capacity (product_id INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE, batch_size INT NOT NULL CHECK(batch_size>0), minutes_per_batch INT NOT NULL CHECK(minutes_per_batch>0))`); const ids=items.map(x=>x.product_id); const ps=await c.query('SELECT id,name,price FROM products WHERE id=ANY($1) AND active=true FOR SHARE',[ids]); const map=Object.fromEntries(ps.rows.map(x=>[x.id,x])); let total=0; for(const x of items){if(!map[x.product_id]||x.quantity<1)throw Error('สินค้าไม่ถูกต้อง'); total+=Number(map[x.product_id].price)*Number(x.quantity);} const cap=await c.query(`SELECT p.name,pc.batch_size,pc.minutes_per_batch,COALESCE(SUM(oi.quantity) FILTER(WHERE o.status IN ('confirmed','in_production','ready_for_packing')),0) queued FROM production_capacity pc JOIN products p ON p.id=pc.product_id LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id GROUP BY p.name,pc.batch_size,pc.minutes_per_batch`); const capMap=Object.fromEntries(cap.rows.map(x=>[x.name,x])); for(const x of items){
  const p=map[x.product_id], cc=capMap[p.name];
  if(cc){
    const capacityLimit=Number(cc.batch_size)*4;
    const requested=Number(x.quantity);
    const queued=Number(cc.queued)||0;
    if(requested+queued>capacityLimit){
      throw Object.assign(new Error(`กำลังการผลิตของ ${p.name} เกินขีดจำกัดที่ระบบกำหนด`),{
        code:'CAPACITY',
        capacity:{product_id:Number(p.id),product:p.name,requested,queued,limit:capacityLimit,batch_size:Number(cc.batch_size),minutes_per_batch:Number(cc.minutes_per_batch)}
      });
    }
  }
} const resources=await checkResources(c,items); if(resources.length) throw Object.assign(new Error('วัตถุดิบไม่เพียงพอ'),{code:'MATERIALS',details:resources}); const o=(await c.query(`INSERT INTO orders(customer_name,phone,total_price) VALUES($1,$2,$3) RETURNING id`,[customer_name,phone,total])).rows[0]; for(const x of items) await c.query(`INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4)`,[o.id,x.product_id,x.quantity,map[x.product_id].price]); await c.query(`INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,NULL,'pending_review','ลูกค้าส่งคำขอสั่งซื้อ')`,[o.id]); const dailyNo=await dailyOrderNo(c,o.id); await notify(c,'admin','มีออเดอร์ใหม่',`ออเดอร์ #${dailyNo} ลูกค้า ${customer_name} ส่งคำขอสั่งซื้อใหม่`,o.id,`new-order-${o.id}`); await c.query('COMMIT'); res.status(201).json({order_id:o.id,order_number:dailyNo,status:'pending_review',message:`ร้านได้รับคำขอสั่งซื้อ #${dailyNo} แล้ว กำลังรอยืนยัน`});}catch(e){await c.query('ROLLBACK'); console.error(e); res.status(e.code==='MATERIALS'||e.code==='CAPACITY'?409:500).json({error:e.message,details:e.details||[],capacity:e.capacity||null});}finally{c.release();}});
r.post('/capacity-contact',async(req,res)=>{
  const {customer_name,phone,message,product_summary}=req.body||{};
  if(!customer_name||!phone||!message) return res.status(400).json({error:'กรุณากรอกชื่อ เบอร์โทร และข้อความ'});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const row=(await c.query(`INSERT INTO customer_contact_requests(customer_name,phone,message,product_summary) VALUES($1,$2,$3,$4) RETURNING id`,[customer_name.trim(),phone.trim(),message.trim(),product_summary||''])).rows[0];
    await c.query(`INSERT INTO notifications(recipient_role,type,title,message,dedupe_key) VALUES('admin','customer_contact','ลูกค้าขอติดต่อเรื่องกำลังการผลิต',$1,$2) ON CONFLICT(dedupe_key) DO NOTHING`,[
      `คุณ ${customer_name.trim()} โทร ${phone.trim()} · ${message.trim()}${product_summary?` · ${product_summary}`:''}`,
      `customer-contact-${row.id}`
    ]);
    await c.query('COMMIT');
    res.status(201).json({id:row.id,message:'ส่งคำขอติดต่อเจ้าของร้านแล้ว ร้านจะติดต่อกลับตามข้อมูลที่ให้ไว้'});
  }catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'ส่งคำขอติดต่อไม่สำเร็จ'});}finally{c.release();}
});

async function sendTrack(res,o){
  if(!o) return res.status(404).json({error:'ไม่พบออเดอร์'});
  const h=(await query(`SELECT h.from_status,h.to_status,h.changed_at,u.display_name FROM order_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.order_id=$1 ORDER BY h.changed_at`,[o.id])).rows;
  return res.json({id:o.id,daily_no:o.daily_no,order_date:o.order_date,created_at:o.created_at,customer_name:o.customer_name,status:o.status,rejection_reason:o.rejection_reason,cancel_reason:o.cancel_reason,items:o.items,history:h});
}
r.get('/track/number/:dailyNo',async(req,res)=>{
  const n=Number(req.params.dailyNo);
  if(!Number.isInteger(n)||n<1) return res.status(400).json({error:'หมายเลขออเดอร์ไม่ถูกต้อง'});
  const date=/^\d{4}-\d{2}-\d{2}$/.test(req.query.date||'')?req.query.date:null;
  const targetDate=date||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
  const row=(await query(`
    WITH numbered AS (
      SELECT o.*,ROW_NUMBER() OVER (
        PARTITION BY (o.created_at AT TIME ZONE 'Asia/Bangkok')::date
        ORDER BY o.created_at,o.id
      )::int AS daily_no,
      (o.created_at AT TIME ZONE 'Asia/Bangkok')::date AS order_date
      FROM orders o
    )
    SELECT n.*,
      COALESCE((SELECT json_agg(json_build_object('id',oi.id,'product_id',oi.product_id,'name',p.name,'quantity',oi.quantity,'unit_price',oi.unit_price) ORDER BY oi.id)
        FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=n.id),'[]'::json) AS items
    FROM numbered n WHERE n.daily_no=$1 AND n.order_date=$2::date
    LIMIT 1
  `,[n,targetDate])).rows[0];
  return sendTrack(res,row);
});
r.get('/track/:id',async(req,res)=>{
  const o=await getOrder(pool,req.params.id);
  return sendTrack(res,o);
});
r.get('/',auth,allow('admin','kitchen','packing'),async(req,res)=>{
  try{
    const conditions=[];
    if(req.user.role==='kitchen') conditions.push(`n.status IN ('confirmed','in_production','ready_for_packing')`);
    else if(req.user.role==='packing') conditions.push(`n.status IN ('ready_for_packing','packed')`);
    const params=[];
    if(req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)){
      conditions.push(`n.order_date=$1::date`);
      params.push(req.query.date);
    }
    const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
    const rows=(await query(`
      WITH numbered AS (
        SELECT o.*,
               ROW_NUMBER() OVER (
                 PARTITION BY (o.created_at AT TIME ZONE 'Asia/Bangkok')::date
                 ORDER BY o.created_at,o.id
               )::int AS daily_no,
               (o.created_at AT TIME ZONE 'Asia/Bangkok')::date AS order_date
        FROM orders o
      )
      SELECT n.*,
             COALESCE((
               SELECT json_agg(json_build_object('name',p.name,'quantity',oi.quantity) ORDER BY oi.id)
               FROM order_items oi
               LEFT JOIN products p ON p.id=oi.product_id
               WHERE oi.order_id=n.id
             ),'[]'::json) AS items
      FROM numbered n
      ${where}
      ORDER BY n.created_at,n.id
    `,params)).rows;
    for(const row of rows) row.status=normalizeStatus(row.status);
    return res.json(rows);
  }catch(e){
    console.error('[ORDERS GET ERROR]',e);
    return res.status(500).json({error:'โหลดรายการออเดอร์ไม่สำเร็จ',detail:e.message});
  }
});
r.get('/:id',auth,async(req,res)=>{const o=await getOrder(pool,req.params.id); if(!o)return res.status(404).json({error:'ไม่พบออเดอร์'}); res.json(o);});
r.post('/:id/decision',auth,allow('admin'),async(req,res)=>{const {decision,reason}=req.body; const c=await pool.connect(); try{await c.query('BEGIN'); const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]; if(!o)throw Error('ไม่พบออเดอร์'); const current=normalizeStatus(o.status); if(current!=='pending_review')throw Error('ออเดอร์นี้ไม่ได้อยู่ในสถานะรอตรวจสอบ'); if(o.status!==current)await c.query(`UPDATE orders SET status=$1 WHERE id=$2`,[current,o.id]); const dailyNo=await dailyOrderNo(c,o.id); if(decision==='reject'){await c.query(`UPDATE orders SET status='rejected',rejection_reason=$1,updated_at=NOW() WHERE id=$2`,[reason||'ร้านไม่สามารถรับออเดอร์ได้',o.id]); await c.query(`INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,note) VALUES($1,$2,'rejected',$3,$4)`,[o.id,current,req.user.id,reason]); await notify(c,null,'ผลการตรวจสอบออเดอร์',`ออเดอร์ #${dailyNo} ไม่สามารถรับได้: ${reason||'ไม่ระบุเหตุผล'}`,o.id,`reject-${o.id}`);} else if(decision==='accept'){await c.query(`UPDATE orders SET status='confirmed',updated_at=NOW() WHERE id=$1`,[o.id]); await c.query(`INSERT INTO order_status_history(order_id,from_status,to_status,changed_by) VALUES($1,$2,'confirmed',$3)`,[o.id,current,req.user.id]); await notify(c,'kitchen','มีออเดอร์ที่ยืนยันแล้ว',`ออเดอร์ #${dailyNo} พร้อมเข้าสู่การผลิต`,o.id,`confirmed-kitchen-${o.id}`);} else {throw Error('คำสั่งตัดสินใจไม่ถูกต้อง');} await c.query('COMMIT');res.json({message:decision==='reject'?'ปฏิเสธออเดอร์แล้ว':'ยืนยันออเดอร์แล้ว'});}catch(e){await c.query('ROLLBACK');res.status(409).json({error:e.message});}finally{c.release();}});
r.post('/:id/status',auth,async(req,res)=>{const next=req.body.status; const c=await pool.connect(); try{await c.query('BEGIN'); const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]; if(!o)throw Error('ไม่พบออเดอร์'); const current=normalizeStatus(o.status); const dailyNo=await dailyOrderNo(c,o.id); const idx=FLOW.indexOf(current), ni=FLOW.indexOf(next); const permitted={admin:['pending_review','confirmed','in_production','ready_for_packing','packed','picked_up'],kitchen:['confirmed','in_production','ready_for_packing'],packing:['ready_for_packing','packed','picked_up']}; if(!permitted[req.user.role]?.includes(next)||ni!==idx+1)throw Error('ไม่สามารถข้ามขั้นตอนหรือไม่มีสิทธิ์เปลี่ยนสถานะนี้'); let inventoryResult=null; if(next==='ready_for_packing') inventoryResult=await consumeInventoryForOrder(c,o.id,req.user.id); await c.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2',[next,o.id]); await c.query(`INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,note) VALUES($1,$2,$3,$4,$5)`,[o.id,current,next,req.user.id,next==='ready_for_packing' ? (inventoryResult?.consumed ? 'ผลิตเสร็จและตัด Stock วัตถุดิบแล้ว' : 'ผลิตเสร็จแล้ว (ไม่มีสูตรวัตถุดิบที่ต้องตัด)') : null]); if(next==='in_production')await notify(c,'kitchen','เริ่มผลิตออเดอร์',`ออเดอร์ #${dailyNo} เริ่มผลิตแล้ว`,o.id,`prod-${o.id}`); if(next==='ready_for_packing')await notify(c,'packing','มีออเดอร์รอแพ็ก',`ออเดอร์ #${dailyNo} ผลิตเสร็จและพร้อมแพ็ก`,o.id,`pack-${o.id}`); await c.query('COMMIT');res.json({message:`เปลี่ยนเป็น ${LABEL[next]} แล้ว`});}catch(e){await c.query('ROLLBACK');res.status(409).json({error:e.message,details:e.details||[]});}finally{c.release();}});
r.post('/:id/cancel',async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!o)throw Error('ไม่พบออเดอร์');if(!['pending_review','confirmed'].includes(o.status))throw Error('ไม่สามารถยกเลิกได้หลังเริ่มผลิต');await c.query(`UPDATE orders SET status='cancelled',cancel_reason=$1 WHERE id=$2`,[req.body.reason||'ลูกค้าขอยกเลิก',o.id]);await c.query(`INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,$2,'cancelled',$3)`,[o.id,o.status,req.body.reason]);await c.query('COMMIT');res.json({message:'ยกเลิกออเดอร์แล้ว'});}catch(e){await c.query('ROLLBACK');res.status(409).json({error:e.message});}finally{c.release();}});
r.get('/:id/history',auth,async(req,res)=>res.json((await query(`SELECT h.*,u.display_name FROM order_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE order_id=$1 ORDER BY changed_at`,[req.params.id])).rows));
module.exports=r;
