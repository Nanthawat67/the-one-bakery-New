const fs=require('fs');
const {query}=require('../config/db');
const {seed}=require('./seed');

async function init(){
  const sql=fs.readFileSync(__dirname+'/schema.sql','utf8');
  await query(sql);
  await seed();
}

module.exports={init};
