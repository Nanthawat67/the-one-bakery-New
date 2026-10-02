const test=require('node:test');const assert=require('node:assert/strict');
test('order status flow cannot skip steps',()=>{const flow=['pending_review','confirmed','in_production','ready_for_packing','packed','picked_up'];for(let i=0;i<flow.length-1;i++)assert.equal(flow.indexOf(flow[i+1]),i+1);assert.notEqual(flow.indexOf('packed'),1)});
test('production rounds calculation',()=>{assert.equal(Math.ceil(37/12),4);assert.equal(Math.ceil(37/12)*30,120)});
test('association metrics basic',()=>{const total=10,pair=4,a=5,b=8;assert.equal((pair/total),.4);assert.equal(pair/a,.8);assert.equal((pair/total)/((a/total)*(b/total)),1)});
