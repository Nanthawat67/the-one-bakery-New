const bcrypt=require('bcryptjs');
const {query}=require('../config/db');

async function ensureUser(username,password,role,displayName){
  const h=await bcrypt.hash(password,12);
  await query(`INSERT INTO users(username,password_hash,role,display_name)
    VALUES($1,$2,$3,$4)
    ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,display_name=EXCLUDED.display_name,active=true`,
    [username,h,role,displayName]);
}

async function ensureProduct(name,price,image){
  const q=await query('SELECT id FROM products WHERE name=$1 ORDER BY id LIMIT 1',[name]);
  if(q.rowCount) return q.rows[0].id;
  return (await query('INSERT INTO products(name,price,image_url,active) VALUES($1,$2,$3,true) RETURNING id',[name,price,image])).rows[0].id;
}

async function ensureInventory(name,unit,stock,reorder){
  const q=await query('SELECT id FROM inventory WHERE name=$1 ORDER BY id LIMIT 1',[name]);
  if(q.rowCount) return q.rows[0].id;
  return (await query('INSERT INTO inventory(name,unit,stock,reorder_level) VALUES($1,$2,$3,$4) RETURNING id',[name,unit,stock,reorder])).rows[0].id;
}

async function ensureRecipe(productId,ingredientId,quantity){
  await query(`INSERT INTO recipes(product_id,ingredient_id,quantity)
    VALUES($1,$2,$3)
    ON CONFLICT(product_id,ingredient_id) DO NOTHING`,[productId,ingredientId,quantity]);
}

async function ensureCapacity(productId,batchSize,minutesPerBatch){
  await query(`INSERT INTO production_capacity(product_id,batch_size,minutes_per_batch)
    VALUES($1,$2,$3)
    ON CONFLICT(product_id) DO NOTHING`,[productId,batchSize,minutesPerBatch]);
}

async function seed(){
  await ensureUser('admin','admin123','admin','ผู้ดูแลร้าน');
  await ensureUser('kitchen','kitchen123','kitchen','ฝ่ายผลิต');
  await ensureUser('packing','packing123','packing','ฝ่ายแพ็ก');

  const products={};
  const productSeed=[
    ['ครัวซองต์',45,'/images/croissant.jpg'],
    ['เค้กส้ม',60,'/images/orange-cake.jpg'],
    ['เค้กช็อกโกแลต',65,'/images/chocolate-cake.jpg'],
    ['คุกกี้',25,'/images/cookie.jpg'],
    ['ขนมปังนม',35,'/images/milk-bread.jpg']
  ];
  for(const [name,price,image] of productSeed) products[name]=await ensureProduct(name,price,image);

  const inventory={};
  const inventorySeed=[
    ['แป้ง','กรัม',50000,5000],['เนย','กรัม',12000,2000],['น้ำตาล','กรัม',10000,1500],
    ['ไข่','ฟอง',300,30],['ช็อกโกแลต','กรัม',5000,500],['นม','มิลลิลิตร',10000,1500],['ส้ม','กรัม',8000,1000]
  ];
  for(const x of inventorySeed) inventory[x[0]]=await ensureInventory(...x);

  const recipes={
    'ครัวซองต์':[['แป้ง',100],['เนย',30],['น้ำตาล',10],['ไข่',0.1]],
    'เค้กส้ม':[['แป้ง',120],['น้ำตาล',60],['ไข่',1],['ส้ม',40]],
    'เค้กช็อกโกแลต':[['แป้ง',120],['น้ำตาล',60],['ไข่',1],['ช็อกโกแลต',30]],
    'คุกกี้':[['แป้ง',50],['เนย',20],['น้ำตาล',15]],
    'ขนมปังนม':[['แป้ง',100],['นม',50],['น้ำตาล',10],['เนย',10]]
  };
  for(const [productName,items] of Object.entries(recipes)){
    for(const [ingredientName,qty] of items) await ensureRecipe(products[productName],inventory[ingredientName],qty);
  }

  const caps={'ครัวซองต์':[12,30],'เค้กส้ม':[6,45],'เค้กช็อกโกแลต':[6,45],'คุกกี้':[24,30],'ขนมปังนม':[12,30]};
  for(const [productName,[batchSize,minutes]] of Object.entries(caps)) await ensureCapacity(products[productName],batchSize,minutes);
}

module.exports={seed};
